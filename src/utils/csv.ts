import fs from 'fs'
import csv from 'csv-parser'

export interface CSVRow {
	[key: string]: string
}

export async function readCSV<T extends CSVRow>(filePath: string): Promise<T[]> {
	const results: T[] = []

	return new Promise((resolve, reject) => {
		fs.createReadStream(filePath)
			.pipe(csv())
			.on('data', (data: CSVRow) => {
				const row = {} as T
				for (const [key, value] of Object.entries(data)) {
					row[key as keyof T] = value as unknown as T[keyof T]
				}
				results.push(row)
			})
			.on('end', () => {
				resolve(results)
			})
			.on('error', (err) => {
				reject(err)
			})
	})
}

export async function writeCSV<T extends CSVRow>(filePath: string, data: T[]): Promise<void> {
	return new Promise((resolve, reject) => {
		const headers = Object.keys(data[0]).join(',')
		const stream = fs.createWriteStream(filePath)
		stream.write(`${headers}\n`)

		data.forEach((row) => {
			const values = Object.values(row).join(',')
			stream.write(`${values}\n`)
		})

		stream.on('finish', () => {
			resolve()
		})

		stream.on('error', (err) => {
			reject(err)
		})

		stream.end()
	})
}
