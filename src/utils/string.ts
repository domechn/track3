export const insertEllipsis = (str: string, maxLength: number) => {
	if (str.length <= maxLength) {
		return str
	}

	const ellipsisLength = 3 // 省略号的长度
	const charsToShow = maxLength - ellipsisLength
	const frontChars = Math.ceil(charsToShow / 2)
	const backChars = Math.floor(charsToShow / 2)

	const front = str.slice(0, frontChars)
	const back = str.slice(-backChars)

	return front + '...' + back
};
