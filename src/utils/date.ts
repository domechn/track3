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

export const parseDateToTS = (dateStr: string): number => {
	const [year, month, day] = dateStr.split('-').map(Number)
	return new Date(year, month - 1, day).getTime()
}
