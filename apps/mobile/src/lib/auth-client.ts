import { createAuthClient } from 'better-auth/client'

export const authClient = createAuthClient({
	baseURL: process.env.EXPO_PUBLIC_API_URL,
})
