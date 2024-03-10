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
		this.getCacheProvider().set(key, {
			validUntil: vu,
			data: value
		})
	}

	private getCacheProvider() {
		return this.provider
	}

	public getCache<T>(key: string): T | undefined {
		const cv = this.getCacheProvider().get(key)

		if (!cv) {
			return
		}
		if (cv.validUntil && cv.validUntil < Date.now()) {
			this.getCacheProvider().delete(key)
			return
		}

		return cv.data as T
	}

	public clearCache() {
		console.debug("clear cache")

		this.getCacheProvider().clear()
	}
}
