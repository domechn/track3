type CacheValue = {
	validUntil: number
	data: unknown
}

export class CacheCenter {
	private cache: Map<string, CacheValue> = new Map();
	private static instance: CacheCenter
	private constructor() { }
	public static getInstance() {
		if (!this.instance) {
			this.instance = new CacheCenter()
		}
		return this.instance
	}

	// ttl is second
	public setCache<T>(key: string, value: T, ttl = 0) {
		const vu = ttl > 0 ? Date.now() + ttl * 1000 : 0
		this.cache.set(key, {
			validUntil: vu,
			data: value
		})
	}

	public getCache<T>(key: string): T | undefined {
		const cv = this.cache.get(key)
		
		if (!cv) {
			return
		}
		if (cv.validUntil && cv.validUntil < Date.now()) {
			this.cache.delete(key)
			return
		}

		return cv.data as T
	}

	public clearCache() {
		console.debug("clear cache");
		
		this.cache.clear()
	}
}
