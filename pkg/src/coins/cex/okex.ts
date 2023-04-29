import { Exchanger } from './cex'

export class OkexExchange implements Exchanger {
	fetchTotalBalance(): Promise<{ [k: string]: number }> {
		throw new Error('Method not implemented.')
	}

}