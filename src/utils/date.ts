const offset = -(new Date().getTimezoneOffset() * 60 * 1000)

const pad = (n: number) => n < 10 ? `0${n}` : '' + n

export const timestampToDate = (timestamp: number, showTime = false) => {
	const date = new Date(timestamp)

	const dateStr = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`
	if (!showTime) {
		return dateStr
	}

	const timeStr = `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
	return `${dateStr} ${timeStr}`
}
