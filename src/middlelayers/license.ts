import { getClientID } from '@/utils/app'
import { sendHttpRequest } from './datafetch/utils/http'

export class LicenseCenter {
	private static instance: LicenseCenter

	private readonly endpoint = "https://track3-pro-api.domc.me"

	private readonly validateEndpoint = this.endpoint + "/api/license/validate"
	private readonly activeEndpoint = this.endpoint + "/api/license/active"
	private readonly inactiveEndpoint = this.endpoint + "/api/license/inactive"
	private readonly isProEndpoint = this.endpoint + "/api/license/isPro"

	private constructor() { }

	public static getInstance(): LicenseCenter {
		if (!LicenseCenter.instance) {
			LicenseCenter.instance = new LicenseCenter()
		}

		return LicenseCenter.instance
	}

	public async validateLicense(license: string): Promise<{
		isValid: boolean,
	}> {
		const resp = await sendHttpRequest<{
			isValid: boolean
		}>("POST", this.validateEndpoint, 10000, {
			"x-track3-client-id": await getClientID(),
			'x-track3-api-key': license
		})

		return {
			isValid: resp.isValid
		}
	}

	public async activeLicense(license: string): Promise<{
		success: boolean
		error?: string
	}> {

		const resp = await sendHttpRequest<{
			success: boolean
			error?: string
		}>("POST", this.activeEndpoint, 10000, {
			"x-track3-client-id": await getClientID(),
			'x-track3-api-key': license
		})

		return {
			success: resp.success,
			error: resp.error
		}
	}

	public async inactiveLicense(license: string): Promise<{ success: boolean, error?: string }> {
		const resp = await sendHttpRequest<{
			success: boolean
			error?: string
		}>("POST", this.inactiveEndpoint, 10000, {
			"x-track3-client-id": await getClientID(),
			'x-track3-api-key': license
		})

		return {
			success: resp.success,
			error: resp.error
		}
	}

	public async isProUser(license: string): Promise<boolean> {
		const resp = await sendHttpRequest<{
			isPro: boolean
		}>("POST", this.isProEndpoint, 10000, {
			"x-track3-client-id": await getClientID(),
			'x-track3-api-key': license
		})

		return resp.isPro
	}
}
