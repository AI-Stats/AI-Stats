'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { resolveAuthCallbackUrl } from '@/lib/auth/authOrigin'
import { sanitizeReturnUrl } from '@/lib/auth/return-url'
import { getBetterAuth } from '@/lib/auth/betterAuth'

function buildRedirect(pathname: string, params: Record<string, string | undefined>) {
	const url = new URL(pathname, 'http://localhost')
	for (const [key, value] of Object.entries(params)) {
		if (value) url.searchParams.set(key, value)
	}
	return `${url.pathname}${url.search}`
}

function buildCallbackPath(params: {
	returnUrl?: string
	type?: 'email'
}) {
	const url = new URL('/auth/callback', 'http://localhost')
	if (params.returnUrl) url.searchParams.set('returnUrl', params.returnUrl)
	if (params.type) url.searchParams.set('type', params.type)
	return `${url.pathname}${url.search}`
}

export async function handleOAuthRedirect(formData: FormData) {
	const provider = String(formData.get('provider') ?? 'google').toLowerCase()
	const returnUrl = sanitizeReturnUrl(formData.get('returnUrl'), '/')
	const safeReturnUrl = returnUrl === '/' ? undefined : returnUrl
	const result = await getBetterAuth().api.signInSocial({
			body: { callbackURL: safeReturnUrl ?? '/', provider },
			headers: await headers(),
		})
	if (!result.url) redirect('/error?message=Authentication failed')
	redirect(result.url)
}

export async function handleEmailSignup(formData: FormData) {
	const email = String(formData.get('email') ?? '')
	const password = String(formData.get('password') ?? '')
	const returnUrl = sanitizeReturnUrl(formData.get('returnUrl'), '/')
	const safeReturnUrl = returnUrl === '/' ? undefined : returnUrl
	const callbackUrl = await resolveAuthCallbackUrl(safeReturnUrl)
	const verificationCallbackUrl = new URL(callbackUrl)
		verificationCallbackUrl.searchParams.set('type', 'better-auth')
		try {
			await getBetterAuth().api.signUpEmail({
				body: {
					email,
					password,
					name: email.split('@')[0] || 'Phaseo user',
					callbackURL: verificationCallbackUrl.toString(),
				},
				headers: await headers(),
			})
		} catch (error) {
			const message = error instanceof Error ? error.message : ''
			if (message.toLowerCase().includes('disabled')) {
				redirect('/error?message=Sign up is currently disabled')
			}
			// Keep duplicate-account responses indistinguishable.
			redirect(buildRedirect('/sign-in', {
				signup: 'check-email',
				returnUrl: safeReturnUrl,
			}))
		}
	redirect(buildRedirect('/sign-in', {
			signup: 'check-email',
			returnUrl: safeReturnUrl,
		}))
}
