import { getClientID } from '@/utils/app'
import { sendHttpRequest } from './datafetch/utils/http'
import { getLicenseIfIsPro, PRO_API_ENDPOINT } from './configuration'
import { UserLicenseInfo } from '@/middlelayers/types'

export async function isProVersion(): Promise<UserLicenseInfo> {
	// check if pro user
	const license = await getLicenseIfIsPro()
	let isPro = false
	if (license) {
		isPro = await LicenseCenter.getInstance().isProUser(license)
	}

	return {
		isPro,
		license
	}
}

export class LicenseCenter {
	private static instance: LicenseCenter

	private readonly endpoint = PRO_API_ENDPOINT

	private readonly validateEndpoint = this.endpoint + "/api/license/validate"
	private readonly activeEndpoint = this.endpoint + "/api/license/active"
	private readonly inactiveEndpoint = this.endpoint + "/api/license/inactive"
	private readonly isProEndpoint = this.endpoint + "/api/license/isPro"
	private readonly createCheckoutSessionEndpoint = this.endpoint + "/api/stripe/create-checkout-session"
	private readonly checkoutStatusEndpoint = this.endpoint + "/api/stripe/checkout-status"
	private readonly customerPortalEndpoint = this.endpoint + "/api/stripe/customer-portal"
	private readonly subscriptionInfoEndpoint = this.endpoint + "/api/license/subscription-info"

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

	public async createCheckoutSession(planType: 'monthly' | 'yearly'): Promise<{
		sessionId: string
		url: string
	}> {
		const resp = await sendHttpRequest<{
			sessionId: string
			url: string
		}>("POST", this.createCheckoutSessionEndpoint, 15000, {
			"x-track3-client-id": await getClientID(),
		}, { planType })

		return resp
	}

	public async getCheckoutStatus(sessionId: string): Promise<{
		status: 'pending' | 'completed' | 'expired'
		license?: string
	}> {
		const resp = await sendHttpRequest<{
			status: 'pending' | 'completed' | 'expired'
			license?: string
		}>("GET", `${this.checkoutStatusEndpoint}?session_id=${sessionId}`, 10000)

		return resp
	}

	public async getCustomerPortalUrl(): Promise<{ url: string }> {
		const license = await getLicenseIfIsPro()
		const resp = await sendHttpRequest<{ url: string }>(
			"POST",
			this.customerPortalEndpoint,
			10000,
			{
				"x-track3-client-id": await getClientID(),
				'x-track3-api-key': license ?? '',
			}
		)

		return resp
	}

	public async getSubscriptionInfo(): Promise<{
		planType: 'monthly' | 'yearly' | null
		status: 'active' | 'past_due' | 'canceled' | 'incomplete' | null
		currentPeriodEnd: string | null
		cancelAtPeriodEnd: boolean
		isLegacy: boolean
	}> {
		const license = await getLicenseIfIsPro()
		const resp = await sendHttpRequest<{
			planType: 'monthly' | 'yearly' | null
			status: 'active' | 'past_due' | 'canceled' | 'incomplete' | null
			currentPeriodEnd: string | null
			cancelAtPeriodEnd: boolean
			isLegacy: boolean
		}>("POST", this.subscriptionInfoEndpoint, 10000, {
			"x-track3-client-id": await getClientID(),
			'x-track3-api-key': license ?? '',
		})

		return resp
	}
}
