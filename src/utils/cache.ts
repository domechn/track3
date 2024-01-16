import { QueryClient } from "react-query"

export const queryClient = new QueryClient()

export class UICacheCenter {
	static getQueryClient() {
		return queryClient
	}

	static clearCache(key: string) {
		queryClient.invalidateQueries(key)
	}
}
