import { getClientID } from '@/utils/app'
import { sendHttpRequest } from './datafetch/utils/http'

export class LicenseCenter {
	private static instance: LicenseCenter

	private readonly validateEndpoint = "https://track3-pro-api.domc.me/api/license/validate"

	private constructor() { }

	public static getInstance(): LicenseCenter {
		if (!LicenseCenter.instance) {
			LicenseCenter.instance = new LicenseCenter()
		}

		return LicenseCenter.instance
	}

	public async validateLicense(license: string): Promise<{
		isPro: boolean,
	}> {
		try {
			const resp = await sendHttpRequest<{
				isPro: boolean
			}>("POST", this.validateEndpoint, 10000, {
				"x-track3-client-id": await getClientID(),
				'x-track3-api-key': license
			})

			return {
				isPro: resp.isPro
			}
		} catch (e) {
			return {
				isPro: false
			}
		}
	}
}