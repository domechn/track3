import { Client } from '@notionhq/client'
import _ from 'lodash'
import { CoinModel, CoinQueryDetail, Database, DatabaseConfig } from '../types'
import { dateToDayStr } from '../utils/date'

export class NotionStore implements Database {
	private readonly config: Pick<DatabaseConfig, 'notion'>
	private readonly latestTitle = "Latest Assets Status"

	private client: Client
	private readonly databaseId: string
	constructor(config: Pick<DatabaseConfig, 'notion'>) {
		this.config = config
		this.databaseId = this.config.notion?.databaseId || ""
		if (!this.databaseId) {
			throw new Error("Notion database id is not set")
		}

		this.client = new Client({
			auth: this.config.notion?.token,
		})
	}
	private getIndex(i: number): string {
		return i > 9 ? `${i}` : `0${i}`
	}

	private prettyNumber(val: number): number {
		return parseFloat(val.toFixed(2))
	}

	private getDatabaseProperties() {
		const topN = _(new Array(10)).map((_, i) => i + 1).map(i => ({
			[`Top${this.getIndex(i)}`]: {
				rich_text: {}
			},
			[`Amount${this.getIndex(i)}`]: {
				number: {
					format: "number_with_commas"
				}
			},
			[`Value${this.getIndex(i)}`]: {
				number: {
					format: "number_with_commas"
				}
			},
		})).reduce((acc, cur) => _.merge(acc, cur), {})
		return {
			Name: {
				title: {}
			},
			Date: {
				date: {}
			},
			// for each 10 times
			...topN,
			TopOthers: {
				rich_text: {}
			},
			AmountOthers: {
				rich_text: {}
			},
			ValueOthers: {
				number: {
					format: "number_with_commas" as any
				}
			},
			ZTotal: {
				number: {
					format: "number_with_commas" as any
				}
			}
		}
	}

	private async initDatabase() {
		await this.client.databases.update({
			database_id: this.databaseId,
			properties: this.getDatabaseProperties()
		})
	}

	private getLatestPageProperties(models: CoinModel[]) {
		const top10 = _(models).sortBy(m => m.value).reverse().take(10).value()
		const others = _(models).sortBy(m => m.value).reverse().drop(10).value()
		const totalValue = _(models).sumBy(m => m.value)
		const top10Props = _(top10).map((m, idx) => {
			const index = this.getIndex(idx + 1)
			const topKey = `Top` + index
			const amountKey = `Amount` + index
			const valueKey = `Value` + index
			return {
				[topKey]: {
					rich_text: [{
						text: {
							content: m.symbol,
						},
					}]
				},
				[amountKey]: {
					number: m.amount,
				},
				[valueKey]: {
					number: this.prettyNumber(m.value),
				},
			}
		}).reduce((acc, cur) => _.merge(acc, cur), {})
		const othersProps = {
			TopOthers: {
				rich_text: [{
					text: {
						content: "Others",
					},
				}]
			},
			AmountOthers: {
				rich_text: [{
					text: {
						content: "N/A"
					}
				}],
			},
			ValueOthers: {
				number: this.prettyNumber(_(others).sumBy(m => m.value)),
			},
		}

		return {
			Name: {
				title: [{
					text: {
						content: this.latestTitle,
					},
				}]
			},
			Date: {
				date: {
					start: dateToDayStr(new Date()),
				}
			},
			...top10Props,
			...othersProps,
			ZTotal: {
				number: this.prettyNumber(totalValue),
			}
		}
	}

	private async updateLatestPage(pageId: string, models: CoinModel[]) {
		const properties = this.getLatestPageProperties(models)

		await this.client.pages.update({
			page_id: pageId,
			properties,
		})
	}

	private async createLatestPage(models: CoinModel[]) {
		const properties = this.getLatestPageProperties(models)

		await this.client.pages.create({
			parent: {
				database_id: this.databaseId
			},
			properties,
		})
	}

	// save data to database
	// for the latest data, we always save it to the same page and update the page's name to a new page
	// why do this?
	// because for some chart plugins, like grid, it always sort the pages by id ( or creation time ), and it is hard to get latest page by using formula they provide
	// but in this way it is easy to get latest page by using index 1, because the latest page id is always the smallest, and the order is 1
	async saveToDatabase(models: CoinModel[]) {
		const queryResp = await this.client.databases.query({
			database_id: this.databaseId,
			filter: {
				property: "Name",
				title: {
					equals: this.latestTitle,
				}
			}
		})

		const pageId = queryResp.results[0]?.id
		// @ts-ignore
		const pageProperties = queryResp.results[0]?.properties
		// if page not exists, means database is not initialized
		if (!pageId) {
			// init database
			await this.initDatabase()
			// create latest page
			await this.createLatestPage(models)

		} else {
			// if page exists, duplicate origin page to a new page and update the new page's name to achieve
			// update latest page
			pageProperties.Name.title[0].text.content = "Archive Assets Status " + (Math.random() + 1).toString(36).substring(6)
			await this.client.pages.create({
				parent: {
					database_id: this.databaseId
				},
				properties: pageProperties,
			})

			await this.updateLatestPage(pageId, models)
		}
	}

	// response data is sorted by date descending
	async queryDatabase(recordSize = 30, dateQuery = 'desc'): Promise<CoinQueryDetail[][]> {
		const queryResp = await this.client.databases.query({
			database_id: this.databaseId,
			filter: {
				property: "Name",
				title: {
					contains: "Assets Status",
				}
			},
			sorts: [
				{
					property: "Date",
					direction: "descending",
				}
			],
			page_size: recordSize,
		})

		const dataFunc = _(queryResp.results).map('properties').map((r: { [k: string]: { rich_text?: { text: { content: string } }[], number?: number, date?: { start: string } } }) => {
			const tops = _(r).pickBy((v, k) => k.startsWith("Top")).map((v, k) => ({
				key: k,
				value: v.rich_text![0].text.content,
			})).sortBy('key').value()
			const amounts = _(r).pickBy((v, k) => k.startsWith("Amount")).map((v, k) => ({
				key: k,
				value: v.number!,
			})).sortBy('key').value()
			const values = _(r).pickBy((v, k) => k.startsWith("Value")).map((v, k) => ({
				key: k,
				value: v.number!,
			})).sortBy('key').value()

			const topModels = _(tops).map((symbol, idx) => {
				return {
					date: new Date(r.Date.date!.start),
					model: {
						symbol: symbol.value,
						amount: amounts[idx].value,
						value: values[idx].value,
					}
				}
			}).value()

			return topModels as CoinQueryDetail[]
		})

		if (dateQuery === 'asc') {
			dataFunc.reverse()
		}
		
		return dataFunc.value() as unknown as CoinQueryDetail[][]
	}
}