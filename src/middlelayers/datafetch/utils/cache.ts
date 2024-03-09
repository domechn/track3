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
	public set(key: string, value: CacheValue) {
		localStorage.setItem(key, JSON.stringify(value))
	}

	public get(key: string): CacheValue | undefined {
		const cv = localStorage.getItem(key)
		if (!cv) {
			return
		}
		return JSON.parse(cv)
	}

	public delete(key: string) {
		localStorage.removeItem(key)
	}

	public clear() {
		localStorage.clear()
	}
}

let memoryCacheInstance: CacheCenter
let localStorageCacheInstance: CacheCenter

export class CacheCenter {
	private provider: CacheProvider
	private constructor(p: CacheProvider) {
		this.provider = p
	}

	public static getMemoryCacheInstance() {
		if (!memoryCacheInstance) {
			memoryCacheInstance = new CacheCenter(new MemoryCacheProvider())
		}
		return memoryCacheInstance
	}

	public static getLocalStorageCacheInstance() {
		if (!localStorageCacheInstance) {
			localStorageCacheInstance = new CacheCenter(new LocalStorageCacheProvider())
		}
		return localStorageCacheInstance
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
