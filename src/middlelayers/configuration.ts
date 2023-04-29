import { getDatabase } from './database'
import { ConfigurationModel } from './types'


export async function getConfiguration(): Promise<ConfigurationModel | undefined> {
	const db = await getDatabase()
	const assets = await db.select<ConfigurationModel[]>(`SELECT * FROM configuration where id = 1`)
	return assets[0]
}


export async function saveConfiguration(data: string) {

	const db = await getDatabase()
	await db.execute(`INSERT OR REPLACE INTO configuration (id, data) VALUES (1, '${data}')`)
}
