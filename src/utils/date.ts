export const timestampToDate = (timestamp: number) => {
	const date = new Date(timestamp)
	return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`
}