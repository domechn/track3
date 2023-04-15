import got from 'got'
import UserAgent from 'user-agents'

export function gotWithFakeUA() {
	const ua = new UserAgent()
	const gotInstance = got.extend({
		headers: {
			"user-agent": ua.toString(),
		},
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
