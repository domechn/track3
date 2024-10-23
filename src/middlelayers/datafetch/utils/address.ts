import _ from 'lodash'
import { Addresses } from '../types'

export function getAddressList(addr: Addresses): string[] {
	const ass = addr.addresses || []
	return _(ass)
		.map(as => {
			if (_(as).isString()) {
				return as as string
			}
			const asp = (as as { address: string, alias?: string, active?: boolean })
			if (asp.active === false) {
				return
			}

			return asp.address
		}).compact().value()
}
