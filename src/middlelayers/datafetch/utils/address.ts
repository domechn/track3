import { Addresses } from '../types'

export function getAddressList(addr: Addresses): string[] {
	return (addr.addresses ?? [])
		.map((as) => {
			if (typeof as === "string") {
				return as
			}
			if (as.active === false) {
				return
			}
			return as.address
		})
		.filter((s): s is string => Boolean(s))
}
