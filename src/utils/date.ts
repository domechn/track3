// return: 2020-01-01
export function dateToDayStr(d: Date): string {
	return d.toISOString().slice(0, 10)
}