import Database from "tauri-plugin-sql-api"

let dbInstance: Database

export async function initTables(db: Database) {
	// await db.execute("DROP TABLE IF EXISTS assets")
	// await db.execute(`INSERT INTO assets (
	// 	top01,
	// 	amount01,
	// 	value01,
	// 	top02,
	// 	amount02,
	// 	value02,
	// 	top03,
	// 	amount03,
	// 	value03,
	// 	top04,
	// 	amount04,
	// 	value04,
	// 	top05,
	// 	amount05,
	// 	value05,
	// 	top06,
	// 	amount06,
	// 	value06,
	// 	top07,
	// 	amount07,
	// 	value07,
	// 	top08,
	// 	amount08,
	// 	value08,
	// 	top09,
	// 	amount09,
	// 	value09,
	// 	top10,
	// 	amount10,
	// 	value10,
	// 	amountOthers,
	// 	valueOthers,
	// 	total
	// ) VALUES (
	// 	"BTC",
	// 	1,
	// 	10000,
	// 	"ETH",
	// 	2,
	// 	2000,
	// 	"XRP",
	// 	3,
	// 	3000,
	// 	"USDT",
	// 	4,
	// 	4000,
	// 	"BCH",

	// 	5,
	// 	5000,
	// 	"BSV",
	// 	6,
	// 	6000,
	// 	"LTC",
	// 	7,
	// 	7000,
	// 	"BNB",
	// 	8,
	// 	8000,
	// 	"EOS",
	// 	9,
	// 	9000,
	// 	"LINK",
	// 	10,
	// 	10000,
	// 	100000,
	// 	1000000,
	// 	1000001
	// )`)
	console.log("initTables");
	
	await db.execute(`CREATE TABLE IF NOT EXISTS "assets" (
		id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT UNIQUE,
		createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
		top01 TEXT,
		value01 REAL,
		amount01 REAL,
		top02 TEXT,
		value02 REAL,
		amount02 REAL,
		top03 TEXT,
		value03 REAL,
		amount03 REAL,
		top04 TEXT,
		value04 REAL,
		amount04 REAL,
		top05 TEXT,
		value05 REAL,
		amount05 REAL,
		top06 TEXT,
		value06 REAL,
		amount06 REAL,
		top07 TEXT,
		value07 REAL,
		amount07 REAL,
		top08 TEXT,
		value08 REAL,
		amount08 REAL,
		top09 TEXT,
		value09 REAL,
		amount09 REAL,
		top10 TEXT,
		value10 REAL,
		amount10 REAL,
		valueOthers REAL,
		amountOthers TEXT,
		total REAL
)`)

await db.execute(`CREATE TABLE IF NOT EXISTS "configuration" (
	id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT UNIQUE,
	data TEXT NOT NULL
)`)
}

export async function getDatabase(): Promise<Database> {
	
	if (dbInstance) {
		return dbInstance
	}
	dbInstance = await Database.load("sqlite:track3.db")
	return dbInstance
}
