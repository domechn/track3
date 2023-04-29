import bluebird from 'bluebird'

export async function asyncMap<K, V>(items: K[], fn: (item: K) => Promise<V>, concurrency = 1, delay = 0): Promise<V[]> {
	return bluebird.map(items, async item => {
		const res = await fn(item)
		await bluebird.delay(delay)
		return res
	}, { concurrency })
}
