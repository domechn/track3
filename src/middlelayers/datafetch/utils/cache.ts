type CacheValue = {
	validUntil: number
	data: unknown
}

interface CacheProvider {
	set(key: string, value: CacheValue): void
	get(key: string): CacheValue | undefined
	delete(key: string): void
	clear(): void
}

class MemoryCacheProvider implements CacheProvider {
	private memoryCacheProvider: Map<string, CacheValue> = new Map();

	public set(key: string, value: CacheValue) {
		this.memoryCacheProvider.set(key, value)
	}

	public get(key: string): CacheValue | undefined {
		return this.memoryCacheProvider.get(key)
	}

	public delete(key: string) {
		this.memoryCacheProvider.delete(key)
	}

	public clear() {
		this.memoryCacheProvider.clear()
	}

}

class LocalStorageCacheProvider implements CacheProvider {
	private prefix: string
	constructor(prefix: string) {
		this.prefix = prefix + "/"
	}

	private makeKey(key: string) {
		return `${this.prefix}${key}`
	}

	public set(key: string, value: CacheValue) {
		localStorage.setItem(this.makeKey(key), JSON.stringify(value))
	}

	public get(key: string): CacheValue | undefined {
		const cv = localStorage.getItem(this.makeKey(key))
		if (!cv) {
			return
		}
		return JSON.parse(cv)
	}

	public delete(key: string) {
		localStorage.removeItem(this.makeKey(key))
	}

	public clear() {
		Object.keys(localStorage).filter(k => k.startsWith(this.prefix)).forEach(k => localStorage.removeItem(k))
	}
}

// key is groupKey
const memoryCacheInstance = new Map<string, CacheCenter>()
const localStorageCacheInstance = new Map<string, CacheCenter>()
const cacheGroupEpochs = new Map<string, number>()
const CACHE_EPOCH_STORAGE_PREFIX = "track3-cache-epoch/"
const CACHE_EPOCH_SCHEMA = "v1:"

function cacheEpochStorageKey(groupKey: string) {
	return `${CACHE_EPOCH_STORAGE_PREFIX}${groupKey}`
}

function createCacheGroupEpoch() {
	const randomPart = Math.floor(Math.random() * 1000)
	return Date.now() * 1000 + randomPart
}

function parseCacheGroupEpoch(value: string | null) {
	if (!value?.startsWith(CACHE_EPOCH_SCHEMA)) {
		return
	}
	const epoch = Number(value.slice(CACHE_EPOCH_SCHEMA.length))
	if (!Number.isSafeInteger(epoch) || epoch <= 0) {
		return
	}
	return epoch
}

function persistCacheGroupEpoch(groupKey: string, epoch: number) {
	localStorage.setItem(
		cacheEpochStorageKey(groupKey),
		`${CACHE_EPOCH_SCHEMA}${epoch}`,
	)
}

function removeCacheGroupEpochMarker(groupKey: string) {
	try {
		localStorage.removeItem(cacheEpochStorageKey(groupKey))
	} catch {
		console.warn("cache epoch marker cleanup failed")
	}
}

export function getCacheGroupEpoch(groupKey: string) {
	const cached = cacheGroupEpochs.get(groupKey)
	if (cached !== undefined) {
		return cached
	}

	let epoch = createCacheGroupEpoch()
	try {
		const stored = parseCacheGroupEpoch(
			localStorage.getItem(cacheEpochStorageKey(groupKey)),
		)
		if (stored !== undefined) {
			epoch = stored
		} else {
			persistCacheGroupEpoch(groupKey, epoch)
		}
	} catch {
		console.warn("cache epoch persistence failed")
		epoch = -createCacheGroupEpoch()
		removeCacheGroupEpochMarker(groupKey)
	}
	cacheGroupEpochs.set(groupKey, epoch)
	return epoch
}

export function invalidateCacheGroups({
	localStorage = [],
	memory = [],
}: {
	localStorage?: readonly string[]
	memory?: readonly string[]
}) {
	const localStorageGroups = Array.from(new Set(localStorage))
	const memoryGroups = Array.from(new Set(memory))
	const allGroups = new Set([...localStorageGroups, ...memoryGroups])

	for (const groupKey of allGroups) {
		const currentEpoch = getCacheGroupEpoch(groupKey)
		const nextEpoch =
			currentEpoch > 0 ? currentEpoch + 1 : createCacheGroupEpoch()
		cacheGroupEpochs.set(groupKey, nextEpoch)
		try {
			persistCacheGroupEpoch(groupKey, nextEpoch)
		} catch {
			console.warn("cache epoch persistence failed")
			cacheGroupEpochs.set(groupKey, -createCacheGroupEpoch())
			removeCacheGroupEpochMarker(groupKey)
		}
	}

	for (const groupKey of localStorageGroups) {
		try {
			getLocalStorageCacheInstance(groupKey).clearCache()
		} catch {
			console.warn("local storage cache cleanup failed")
		}
	}
	for (const groupKey of memoryGroups) {
		try {
			getMemoryCacheInstance(groupKey).clearCache()
		} catch {
			console.warn("memory cache cleanup failed")
		}
	}
}

export function getMemoryCacheInstance(groupKey?: string) {
	const k = groupKey ?? "default"
	if (!memoryCacheInstance.has(k)) {
		memoryCacheInstance.set(k, new CacheCenter(new MemoryCacheProvider()))
	}
	return memoryCacheInstance.get(k)!
}

export function getLocalStorageCacheInstance(groupKey?: string) {
	const k = groupKey ?? "default"
	if (!localStorageCacheInstance.has(k)) {
		localStorageCacheInstance.set(k, new CacheCenter(new LocalStorageCacheProvider(k)))
	}
	return localStorageCacheInstance.get(k)!
}

export class CacheCenter {
	private provider: CacheProvider
	constructor(p: CacheProvider) {
		this.provider = p
	}

	// ttl is second
	public setCache<T>(key: string, value: T, ttl = 0) {
		const vu = ttl > 0 ? Date.now() + ttl * 1000 : 0
		try {
			this.provider.set(key, {
				validUntil: vu,
				data: value
			})
		} catch {
			console.warn("cache write failed")
		}
	}

	public getCache<T>(key: string): T | undefined {
		let cv: CacheValue | undefined
		try {
			cv = this.provider.get(key)
		} catch {
			console.warn("cache read failed")
			return
		}

		if (!cv) {
			return
		}
		if (cv.validUntil && cv.validUntil < Date.now()) {
			try {
				this.provider.delete(key)
			} catch {
				console.warn("expired cache cleanup failed")
			}
			return
		}

		return cv.data as T
	}

	public clearCache() {
		console.debug("clear cache")

		this.provider.clear()
	}
}
