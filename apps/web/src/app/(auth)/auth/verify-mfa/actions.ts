'use server'

import { resolveAccessibleWorkspaceIdFromCookie } from '@/utils/workspaceCookie'
import { getBetterAuth } from '@/lib/auth/betterAuth'
import { headers } from 'next/headers'

/**
 * Verifies a TOTP MFA challenge during login and upgrades the session to AAL2.
 */
export async function verifyMFALoginAction(code: string) {
	try {
		await getBetterAuth().api.verifyTOTP({
			body: { code, trustDevice: false },
			headers: await headers(),
		})
	} catch {
		throw new Error('Invalid code. Please try again.')
	}
	await resolveAccessibleWorkspaceIdFromCookie()
	return { success: true }
}

export async function signOutMFAAction() {
	await getBetterAuth().api.signOut({ headers: await headers() })
	return { success: true }
}
