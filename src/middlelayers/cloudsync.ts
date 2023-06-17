import { Polybase } from '@polybase/client'
import { getDatabase } from './database'
import { v4 as uuidv4 } from 'uuid'
import { ASSETS_TABLE_NAME, queryAssetsAfterCreatedAt } from './charts'
import { AssetModel, CloudAssetModel } from './types'
import _ from 'lodash'
import Database from 'tauri-plugin-sql-api'
import { getCurrentUA } from './datafetch/utils/http'
import { Body, getClient } from '@tauri-apps/api/http'
import Cookies from 'js-cookie'
import bluebird from 'bluebird'
import { invoke } from '@tauri-apps/api'

type AuthState = {
	type: 'email',
	userId: string,
	email: string,
	publicKey: string,
}

let db: Polybase | undefined

invoke("get_polybase_namespace").then((ns) => {
	console.log("polybase namespace", ns);
})
	

async function getPolybaseDB(): Promise<Polybase> {
	if (db) {
		return db
	}

	const ns = await invoke<string>("get_polybase_namespace")
	if (!ns) {
		throw new Error("cannot get polybase namespace")
	}

	db = new Polybase({
		defaultNamespace: ns,
		signer: async (data: string) => {
			return {
				h: "eth-personal-sign",
				sig: await ethPersonalSign(data),
			}
		}
	})

	return db
}

const RECORD_COLLECTION_NAME = "Record"
const USER_COLLECTION_NAME = "User"

const CLOUD_SYNC_TABLE_NAME = "cloud_sync"

const POLYBASE_STORAGE_PREFIX = "polybase.auth."
const authPath = `${POLYBASE_STORAGE_PREFIX}auth`
const tokenPath = `${POLYBASE_STORAGE_PREFIX}token`

const POLYBASE_AUTH_URL = "https://auth.testnet.polybase.xyz"

const authStateUpdateCallbacks: ((authState?: AuthState) => void)[] = []

// return last sync time, if not exists, return undefined
export async function getLocalLastSyncTime(publicKey: string): Promise<number | undefined> {
	const d = await getDatabase()

	const syncRecords = await d.select<{
		id: string,
		publicKey: string,
		updatedAt: string
	}[]>(`SELECT * FROM ${CLOUD_SYNC_TABLE_NAME} WHERE publicKey = ?`, [publicKey])

	if (syncRecords.length === 0) {
		return
	}

	return new Date(syncRecords[0].updatedAt).getTime()
}

export async function getCloudLastSyncTime(publicKey: string): Promise<number | undefined> {
	return undefined
}

export async function sendVerifyCode(email: string): Promise<void> {
	await sendPostRequest('/api/email/code', {
		email
	})
}

// return public key
export async function signIn(email: string, code: string): Promise<string> {
	const resp = await sendPostRequest<{ userId: string, publicKey: string, token: string }>('/api/email/verify', {
		email,
		code
	})

	const authState: AuthState = {
		type: 'email',
		userId: resp.userId,
		email,
		publicKey: resp.publicKey,
	}

	// set token to cookies by js-cookie
	Cookies.set(tokenPath, resp.token)
	updateAuthState(authState)

	await createUserIfNotExists(resp.publicKey)

	return resp.publicKey
}

function updateAuthState(authState?: AuthState) {
	if (!authState) {
		Cookies.remove(authPath)
		executeAuthStateUpdateCallbacks()
		return
	}
	Cookies.set(authPath, JSON.stringify(authState))
	executeAuthStateUpdateCallbacks(authState)
}

function getToken(): string {
	const t = Cookies.get(tokenPath)
	if (!t) {
		throw new Error("not login")
	}
	return t
}

async function ethPersonalSign(msg: string): Promise<string> {
	const resp = await sendPostRequest<{ sig: string }>('/api/ethPersonalSign', {
		msg,
	}, getToken())
	return resp.sig
}

export function onAuthStateUpdate(callback: (authState?: AuthState) => void) {
	// trigger callback immediately
	const c = Cookies.get(authPath)
	if (c) {
		const as = JSON.parse(c) as AuthState
		callback(as)
	} else {
		callback()
	}
	authStateUpdateCallbacks.push(callback)
}

function executeAuthStateUpdateCallbacks(authState?: AuthState) {
	authStateUpdateCallbacks.forEach((callback) => {
		callback(authState)
	})
}

export async function signOut() {
	updateAuthState()
	Cookies.remove(tokenPath)
}

async function createUserIfNotExists(publicKey: string) {
	const p = await getPolybaseDB()
	let user = await p.collection(USER_COLLECTION_NAME).record(publicKey).get()

	if (!user.exists()) {
		user = await p.collection(USER_COLLECTION_NAME).create([])
	}

	return user
}

export async function getPublicKey() {
	const authString = Cookies.get(authPath)
	if (!authString) {
		throw new Error("not login")
	}
	const as = JSON.parse(authString) as AuthState
	return as.publicKey
}

// list all assets from cloud
async function dumpAssetsFromCloudAfterCreatedAt(createdAt?: number): Promise<AssetModel[]> {
	const p = await getPolybaseDB()
	// filter assets > createdAt from cloud, if createdAt is not provided, get all assets
	const records = await p.collection<CloudAssetModel>(RECORD_COLLECTION_NAME).where("createdAt", ">=", createdAt || 0).sort("createdAt", "desc").get()
	const needSyncedAssets = _(records.data).
		map('data').
		map(record => record.records ? JSON.parse(record.records) as AssetModel[] : []).
		flatten().
		compact().
		map((record) => ({
			id: 0,
			uuid: record.uuid,
			createdAt: new Date(record.createdAt).toISOString(),
			symbol: record.symbol,
			amount: record.amount,
			value: record.value,
			price: record.price,
		}))
		.value()
	return _(needSyncedAssets).map((asset) => ({
		id: asset.id,
		uuid: asset.uuid,
		createdAt: asset.createdAt,
		symbol: asset.symbol,
		amount: asset.amount,
		value: asset.value,
		price: asset.price,
	})).value()
}

async function dumpAssetsFromDBAfterCreatedAt(createdAt?: number): Promise<AssetModel[]> {
	return queryAssetsAfterCreatedAt(createdAt)
}

export async function syncAssetsToCloudAndLocal(publicKey: string, createdAt?: number): Promise<number> {
	const d = await getDatabase()

	let synced = 0

	const cloudAssets = await dumpAssetsFromCloudAfterCreatedAt(createdAt)
	const localAssets = await dumpAssetsFromDBAfterCreatedAt(createdAt)

	// filter assets need to sync to cloud
	const needSyncedAssetsToCloud = _(localAssets).differenceBy(cloudAssets, 'uuid').value()
	if (needSyncedAssetsToCloud.length > 0) {
		// write data to cloud
		synced += await writeAssetsToCloud(publicKey, needSyncedAssetsToCloud)
	}

	// filter assets need to sync to local
	const needSyncedAssetsToDB = _(cloudAssets).differenceBy(localAssets, 'uuid').value()
	if (needSyncedAssetsToDB.length > 0) {
		// write data to local
		synced += await writeAssetsToDB(d, needSyncedAssetsToDB)
	}

	await updateLastSyncTime(d, publicKey)
	return synced
}

async function writeAssetsToCloud(publicKey: string, assets: AssetModel[]): Promise<number> {
	const gas = _(assets).groupBy('uuid').value()
	const p = await getPolybaseDB()
	const res = await bluebird.map(Object.keys(gas), async (uuid) => {
		if (!gas[uuid] || gas[uuid].length === 0) {
			return 0
		}
		// .create(args) args array is defined by the constructor fn
		await p.collection<CloudAssetModel>(RECORD_COLLECTION_NAME).create([
			uuidv4(),
			p.collection(USER_COLLECTION_NAME).record(publicKey),
			uuid,
			JSON.stringify(gas[uuid]),
			// time string to number
			new Date(gas[uuid][0].createdAt).getTime(),
		])
		return 1
	}, { concurrency: 5 })

	return _(res).sum()
}

// return updated how many records
async function writeAssetsToDB(d: Database, assets: AssetModel[]): Promise<number> {
	const insertValuesStr = assets.map(() => `(?, ?, ?, ?, ?, ?)`).join(", ")

	const res = await d.execute(`INSERT INTO ${ASSETS_TABLE_NAME} (uuid, createdAt, symbol, amount, value, price) VALUES ${insertValuesStr}`, _(assets).map((asset) => [
		asset.uuid,
		asset.createdAt,
		asset.symbol,
		asset.amount,
		asset.value,
		asset.price,
	]).flatten().value())

	return res.rowsAffected
}

async function updateLastSyncTime(d: Database, publicKey: string) {
	await d.execute(`INSERT INTO ${CLOUD_SYNC_TABLE_NAME} (publicKey, updatedAt) VALUES (?, ?) ON CONFLICT(publicKey) DO UPDATE SET updatedAt = ?`, [publicKey, new Date().toISOString(), new Date().toISOString()])
}

async function sendPostRequest<T>(path: string, body: object, token?: string): Promise<T> {
	const client = await getClient()
	const headers: { [k: string]: string } = {
		"user-agent": getCurrentUA(),
	}

	if (token) {
		headers["authorization"] = `Bearer ${token}`
	}
	const resp = await client.request<T>({
		method: "POST",
		url: POLYBASE_AUTH_URL + path,
		timeout: 10000,
		headers,
		body: Body.json(body),
	})

	if (!resp.ok) {
		throw new Error(`Failed to request ${path}, status: ${resp.status}`)
	}

	return resp.data
}
