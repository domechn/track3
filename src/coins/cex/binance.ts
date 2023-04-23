import { Exchanger } from './cex'

export class BinanceExchange implements Exchanger {
	fetchTotalBalance(): Promise<{ [k: string]: number }> {
		throw new Error('Method not implemented.')
	}

}