let offset = -(new Date().getTimezoneOffset() * 60 * 1000)

export const timestampToDate = (timestamp: number, showTime = false) => {
	const date = new Date(timestamp + offset)
	
	const dateStr = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`
	if (!showTime) {
		return dateStr
	}

	const timeStr = `${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}`
	return `${dateStr} ${timeStr}`
}