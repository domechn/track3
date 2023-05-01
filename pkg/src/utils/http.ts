import got from 'got'
import UserAgent from 'user-agents'

let ua: string

export function getFakeUA() {
	if (!ua) {
		ua = (new UserAgent()).toString()
	}
	return ua
}

export function gotWithFakeUA(timeout = 5000) {
	const gotInstance = got.extend({
		headers: {
			"user-agent": getFakeUA(),
		},
		timeout,
		// hooks: {
		// 	beforeRequest: [
		// 		options => {
		// 			console.log(options.headers);

		// 		}
		// 	]
		// }
	})
	return gotInstance
}
