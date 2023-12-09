import _ from 'lodash'
import { saveModelsToDatabase, selectFromDatabase } from '../database'
import { ExchangeRate } from '../datafetch/currencies'
import { CurrencyRateDetail, CurrencyRateModel } from '../types'

class CurrencyRateHandler {
	private readonly tableName = "currency_rates"

	async listCurrencyRates(): Promise<CurrencyRateDetail[]> {
		let rows = await selectFromDatabase<CurrencyRateModel>(this.tableName, {})
		if (!rows || rows.length === 0) {
			console.log("no currency rates found, updating...")
			rows = await this.updateAllCurrencyRates()
		}

		return _(rows).sortBy("priority").value()
	}

	getDefaultCurrencyRate(): CurrencyRateDetail {
		const [alias, symbol, currency, _priority] = CURRENCY_DETAILS["USD"]
		return {
			currency: currency as string,
			alias: alias as string,
			symbol: symbol as string,
			rate: 1,
		}
	}

	async getCurrencyRateByCurrency(currency: string): Promise<CurrencyRateDetail> {
		const rows = await selectFromDatabase<CurrencyRateModel>(this.tableName, { currency })
		if (!rows || rows.length === 0) {
			console.error("find currency rate failed, not found:", currency)
			return this.getDefaultCurrencyRate()
		}

		return rows[0]
	}

	async updateAllCurrencyRates() {
		const q = new ExchangeRate()

		const rates = await q.listAllCurrencyRates()

		const updatedAt = new Date().toISOString()

		const res: CurrencyRateModel[] = []

		
		// insert into currency_rates if currency not exists else update it
		for (const r of rates) {
			const { currency, rate } = r
			const detail = CURRENCY_DETAILS[currency]
			if (detail === undefined) {
				continue
			}
			
			const [alias, symbol, _cur, priority] = detail
			res.push({
				currency,
				alias: alias as string,
				symbol: symbol as string,
				priority: priority as number,
				rate,
				updatedAt: updatedAt
			} as CurrencyRateModel)
		}
		await saveModelsToDatabase(this.tableName, res)

		return res
	}
}

export const CURRENCY_RATE_HANDLER = new CurrencyRateHandler()

// value: 1. alias, 2. symbol, 3. currency 4. priority
const CURRENCY_DETAILS: { [k: string]: (string | number)[] } = {
	// commonly used
	"USD": ["US dollar", "$", "USD", 0],
	"EUR": ["Euro", "€", "EUR", 1],
	"AUD": ["Australian dollar", "$", "AUD", 1],
	"BGN": ["Bulgarian lev", "лв", "BGN", 2],
	"BRL": ["Brazilian Real", "R$", "BRL", 2],
	"CAD": ["Canadian dollar", "$", "CAD", 2],
	"CHF": ["Swiss franc", "CHF", "CHF", 2],
	"CNY": ["Chinese yuan renminbi", "¥", "CNY", 1],
	"CZK": ["Czech koruna", "Kč", "CZK", 2],
	"DKK": ["Danish krone", "kr", "DKK", 2],
	"GBP": ["Pound sterling", "£", "GBP", 2],
	"HKD": ["Hong Kong dollar", "$", "HKD", 1],
	"HRK": ["Croatian kuna", "kn", "HRK", 2],
	"HUF": ["Hungarian forint", "Ft", "HUF", 2],
	"IDR": ["Indonesian rupiah", "Rp", "IDR", 2],
	"ILS": ["Israeli shekel", "₪", "ILS", 2],
	"INR": ["Indian rupee", "₹", "INR", 2],
	"JPY": ["Japanese yen", "¥", "JPY", 1],
	"KRW": ["South Korean won", "₩", "KRW", 2],
	"MXN": ["Mexican peso", "$", "MXN", 2],
	"MYR": ["Malaysian ringgit", "RM", "MYR", 2],
	"NOK": ["Norwegian krone", "kr", "NOK", 2],
	"NZD": ["New Zealand dollar", "$", "NZD", 2],
	"PHP": ["Philippine peso", "₱", "PHP", 2],
	"PLN": ["Polish zloty", "zł", "PLN", 2],
	"RON": ["New Romanian leu", "lei", "RON", 2],
	"RUB": ["Russian rouble", "₽", "RUB", 2],
	"SEK": ["Swedish krona", "kr", "SEK", 2],
	"SGD": ["Singapore dollar", "$", "SGD", 1],
	"THB": ["Thai baht", "฿", "THB", 2],
	"TRY": ["Turkish lira", "₺", "TRY", 2],
	"ZAR": ["South African rand", "R", "ZAR", 2],
	// not commonly used
	"AED": ["UAE dirham", "د.إ", "AED", 99],
	"AFN": ["Afghan afghani", "؋", "AFN", 99],
	"ALL": ["Albanian lek", "L", "ALL", 99],
	"AMD": ["Armenian dram", "֏", "AMD", 99],
	"ANG": ["Netherlands Antillean guilder", "ƒ", "ANG", 99],
	"AOA": ["Angolan kwanza", "Kz", "AOA", 99],
	"ARS": ["Argentine peso", "$", "ARS", 99],
	"AWG": ["Aruban florin", "ƒ", "AWG", 99],
	"AZN": ["Azerbaijani manat", "₼", "AZN", 99],
	"BAM": ["Bosnia and Herzegovina convertible mark", "KM", "BAM", 99],
	"BBD": ["Barbados dollar", "$", "BBD", 99],
	"BDT": ["Bangladeshi taka", "৳", "BDT", 99],
	"BHD": ["Bahraini dinar", "ب.د", "BHD", 99],
	"BIF": ["Burundian franc", "Fr", "BIF", 99],
	"BMD": ["Bermudian dollar", "$", "BMD", 99],
	"BND": ["Brunei dollar", "$", "BND", 99],
	"BOB": ["Boliviano", "Bs.", "BOB", 99],
	"BSD": ["Bahamian dollar", "$", "BSD", 99],
	"BTN": ["Bhutanese ngultrum", "Nu.", "BTN", 99],
	"BWP": ["Botswana pula", "P", "BWP", 99],
	"BYN": ["Belarusian ruble", "Br", "BYN", 99],
	"BZD": ["Belize dollar", "BZ$", "BZD", 99],
	"CDF": ["Congolese franc", "Fr", "CDF", 99],
	"CLF": ["Unidad de Fomento", "UF", "CLF", 99],
	"CLP": ["Chilean peso", "$", "CLP", 99],
	"COP": ["Colombian peso", "$", "COP", 99],
	"CRC": ["Costa Rican colon", "₡", "CRC", 99],
	"CUC": ["Cuban convertible peso", "$", "CUC", 99],
	"CUP": ["Cuban peso", "₱", "CUP", 99],
	"CVE": ["Cape Verde escudo", "Esc", "CVE", 99],
	"DJF": ["Djiboutian franc", "Fr", "DJF", 99],
	"DOP": ["Dominican peso", "RD$", "DOP", 99],
	"DZD": ["Algerian dinar", "د.ج", "DZD", 99],
	"EGP": ["Egyptian pound", "£", "EGP", 99],
	"ERN": ["Eritrean nakfa", "Nfk", "ERN", 99],
	"ETB": ["Ethiopian birr", "Br", "ETB", 99],
	"FJD": ["Fiji dollar", "$", "FJD", 99],
	"FKP": ["Falkland Islands pound", "£", "FKP", 99],
	"GEL": ["Georgian lari", "₾", "GEL", 99],
	"GHS": ["Ghanaian cedi", "₵", "GHS", 99],
	"GIP": ["Gibraltar pound", "£", "GIP", 99],
	"GMD": ["Gambian dalasi", "D", "GMD", 99],
	"GNF": ["Guinean franc", "Fr", "GNF", 99],
	"GTQ": ["Guatemalan quetzal", "Q", "GTQ", 99],
	"GYD": ["Guyanese dollar", "$", "GYD", 99],
	"HNL": ["Honduran lempira", "L", "HNL", 99],
	"HTG": ["Haitian gourde", "G", "HTG", 99],
	"IQD": ["Iraqi dinar", "ع.د", "IQD", 99],
	"IRR": ["Iranian rial", "﷼", "IRR", 99],
	"JMD": ["Jamaican dollar", "J$", "JMD", 99],
	"JOD": ["Jordanian dinar", "د.ا", "JOD", 99],
	"KES": ["Kenyan shilling", "Sh", "KES", 99],
	"KGS": ["Kyrgyzstani som", "с", "KGS", 99],
	"KHR": ["Cambodian riel", "៛", "KHR", 99],
	"KMF": ["Comoro franc", "Fr", "KMF", 99],
	"KPW": ["North Korean won", "₩", "KPW", 99],
	"KWD": ["Kuwaiti dinar", "د.ك", "KWD", 99],
	"KYD": ["Cayman Islands dollar", "$", "KYD", 99],
	"KZT": ["Kazakhstani tenge", "₸", "KZT", 99],
	"LAK": ["Lao kip", "₭", "LAK", 99],
	"LBP": ["Lebanese pound", "ل.ل", "LBP", 99],
	"LKR": ["Sri Lankan rupee", "Rs", "LKR", 99],
	"LRD": ["Liberian dollar", "$", "LRD", 99],
	"LSL": ["Lesotho loti", "L", "LSL", 99],
	"LYD": ["Libyan dinar", "ل.د", "LYD", 99],
	"MAD": ["Moroccan dirham", "د.م.", "MAD", 99],
	"MDL": ["Moldovan leu", "L", "MDL", 99],
	"MGA": ["Malagasy ariary", "Ar", "MGA", 99],
	"MNT": ["Mongolian tögrög", "₮", "MNT", 99],
	"MOP": ["Macanese pataca", "P", "MOP", 99],
	"MRU": ["Mauritanian ouguiya", "UM", "MRU", 99],
	"MUR": ["Mauritian rupee", "₨", "MUR", 99],
	"MVR": ["Maldivian rufiyaa", ".ރ", "MVR", 99],
	"MWK": ["Malawian kwacha", "MK", "MWK", 99],
	"MZN": ["Mozambican metical", "MT", "MZN", 99],
	"NAD": ["Namibian dollar", "$", "NAD", 99],
	"NGN": ["Nigerian naira", "₦", "NGN", 99],
	"NIO": ["Nicaraguan córdoba", "C$", "NIO", 99],
	"NPR": ["Nepalese rupee", "₨", "NPR", 99],
	"OMR": ["Omani rial", "ر.ع.", "OMR", 99],
	"PAB": ["Panamanian balboa", "B/.", "PAB", 99],
	"PEN": ["Peruvian sol", "S/.", "PEN", 99],
	"PGK": ["Papua New Guinean kina", "K", "PGK", 99],
	"PKR": ["Pakistani rupee", "₨", "PKR", 99],
	"PYG": ["Paraguayan guaraní", "₲", "PYG", 99],
	"QAR": ["Qatari riyal", "ر.ق", "QAR", 99],
	"RSD": ["Serbian dinar", "дин.", "RSD", 99],
	"RWF": ["Rwandan franc", "Fr", "RWF", 99],
	"SAR": ["Saudi riyal", "ر.س", "SAR", 99],
	"SBD": ["Solomon Islands dollar", "$", "SBD", 99],
	"SCR": ["Seychelles rupee", "₨", "SCR", 99],
	"SDG": ["Sudanese pound", "ج.س.", "SDG", 99],
	"SHP": ["Saint Helena pound", "£", "SHP", 99],
	"SLL": ["Sierra Leonean leone", "Le", "SLL", 99],
	"SOS": ["Somali shilling", "Sh", "SOS", 99],
	"SRD": ["Surinamese dollar", "$", "SRD", 99],
	"SSP": ["South Sudanese pound", "£", "SSP", 99],
	"STN": ["São Tomé and Príncipe dobra", "Db", "STN", 99],
	"SVC": ["Salvadoran colón", "₡", "SVC", 99],
	"SYP": ["Syrian pound", "£", "SYP", 99],
	"SZL": ["Swazi lilangeni", "L", "SZL", 99],
	"TJS": ["Tajikistani somoni", "ЅМ", "TJS", 99],
	"TMT": ["Turkmenistan manat", "m", "TMT", 99],
	"TND": ["Tunisian dinar", "د.ت", "TND", 99],
	"TOP": ["Tongan paʻanga", "T$", "TOP", 99],
	"TTD": ["Trinidad and Tobago dollar", "$", "TTD", 99],
	"TWD": ["New Taiwan dollar", "$", "TWD", 99],
	"TZS": ["Tanzanian shilling", "Sh", "TZS", 99],
	"UAH": ["Ukrainian hryvnia", "₴", "UAH", 99],
	"UGX": ["Ugandan shilling", "Sh", "UGX", 99],
	"UYU": ["Uruguayan peso", "$", "UYU", 99],
	"UZS": ["Uzbekistan som", "лв", "UZS", 99],
	"VES": ["Venezuelan bolívar soberano", "Bs.S", "VES", 99],
	"VND": ["Vietnamese đồng", "₫", "VND", 99],
	"VUV": ["Vanuatu vatu", "Vt", "VUV", 99],
	"WST": ["Samoan tālā", "T", "WST", 99],
	"XAF": ["Central African CFA franc", "Fr", "XAF", 99],
	"XCD": ["East Caribbean dollar", "$", "XCD", 99],
	"XDR": ["Special drawing rights", "SDR", "XDR", 99],
	"XOF": ["West African CFA franc", "Fr", "XOF", 99],
	"XPF": ["CFP franc", "Fr", "XPF", 99],
	"YER": ["Yemeni rial", "﷼", "YER", 99],
	"ZMW": ["Zambian kwacha", "ZK", "ZMW", 99],
	"ZWL": ["Zimbabwean dollar", "$", "ZWL", 99],
}
