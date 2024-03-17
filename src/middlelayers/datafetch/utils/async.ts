import _ from 'lodash'
import bluebird from 'bluebird'
import { getMemoryCacheInstance } from './cache'

// send http request and cache the result for ttl
export async function asyncMap<K, V>(items: K[], fn: (item: K) => Promise<V>, concurrency = 1, delay = 0, ttl = 600): Promise<V[]> {
	const cc = getMemoryCacheInstance("data-fetch")
	return bluebird.map(items, async item => {
		let cacheKey: string
		if (_(item).isString()) {
			cacheKey = item as string
		} else {
			cacheKey = JSON.stringify(item)
		}

		const cacheResult = cc.getCache<V>(cacheKey)
		if (cacheResult) {
			console.log(`cache hit for ${cacheKey}`)
			return cacheResult
		}

		const res = await fn(item)

		cc.setCache(cacheKey, res, ttl)
		await bluebird.delay(delay)
		return res
	}, { concurrency })
}
