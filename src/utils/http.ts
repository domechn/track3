import got from 'got'
import UserAgent from 'user-agents'

export function getFakeUA() {
	return (new UserAgent()).toString()
}

export function gotWithFakeUA(timeout = 5000) {
	const gotInstance = got.extend({
		headers: {
			"user-agent": getFakeUA(),
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
