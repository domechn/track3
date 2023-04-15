import got from 'got'
import UserAgent from 'user-agents'

export function gotWithFakeUA(timeout = 5000) {
	const ua = new UserAgent()
	const gotInstance = got.extend({
		headers: {
			"user-agent": ua.toString(),
		},
		timeout
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
