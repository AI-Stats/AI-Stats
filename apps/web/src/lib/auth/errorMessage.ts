export const DEFAULT_AUTH_ERROR_MESSAGE = 'We could not complete the sign-in flow. Please try again.'

export type PostLoginError = { code: string; message: string }

export function classifyPostLoginError(error: unknown): PostLoginError {
    const detail = (error instanceof Error ? error.message : String(error ?? '')).toLowerCase()
    if (detail.includes('listfactors') || detail.includes('authenticatorassurance') || detail.includes('mfa')) {
        return {
            code: 'security_check_failed',
            message: 'You are signed in, but Phaseo could not finish checking your account security settings. Please retry sign-in.',
        }
    }
    if (detail.includes('provision_personal_workspace') || detail.includes('workspace')) {
        return {
            code: 'workspace_setup_failed',
            message: 'You are signed in, but Phaseo could not load your workspace. Please retry sign-in. Your account and data are safe.',
        }
    }
    if (detail.includes('connection') || detail.includes('database') || detail.includes('timeout')) {
        return {
            code: 'account_data_unavailable',
            message: 'You are signed in, but account data is temporarily unavailable. Please wait a moment and retry.',
        }
    }
    return {
        code: 'post_login_failed',
        message: 'You are signed in, but Phaseo could not finish loading your account. Please retry sign-in.',
    }
}

export function normalizeAuthErrorMessage(message: string | null | undefined): string {
    const trimmed = String(message ?? '').trim()
    if (!trimmed) return DEFAULT_AUTH_ERROR_MESSAGE
    return trimmed.slice(0, 240)
}

export function buildAuthErrorRedirectUrl(requestUrl: string, message?: string | null, code?: string | null): URL {
    const url = new URL('/error', requestUrl)
    url.searchParams.set('message', normalizeAuthErrorMessage(message))
    if (code) url.searchParams.set('code', code.slice(0, 80))
    return url
}

function mapKnownAuthError(params: URLSearchParams): string | null {
    const errorCode = params.get('error_code')
    if (errorCode === 'otp_expired') {
        return 'Your sign-in link has expired. Please try signing in again.'
    }
    if (
        errorCode === 'sso_provider_not_found' ||
        errorCode === 'saml_idp_not_found' ||
        errorCode === 'saml_relay_state_not_found' ||
        errorCode === 'saml_relay_state_expired'
    ) {
        return 'Enterprise SSO is not configured for your organization yet.'
    }
    if (errorCode === 'saml_provider_disabled') {
        return 'Enterprise SSO is configured but currently disabled.'
    }
    if (errorCode === 'user_sso_managed') {
        return 'This account is managed by SSO. Please use Enterprise SSO to sign in.'
    }

    const error = params.get('error')
    if (error === 'access_denied') {
        return 'Sign-in was cancelled or denied. Please try again.'
    }

    const errorDescription = params.get('error_description')
    if (errorDescription || error || errorCode) {
        return DEFAULT_AUTH_ERROR_MESSAGE
    }

    return null
}

export function resolveCallbackErrorMessage(url: URL): string | null {
    return mapKnownAuthError(url.searchParams)
}

export function resolveHashAuthErrorMessage(hash: string): string | null {
    const normalizedHash = hash.startsWith('#') ? hash.slice(1) : hash
    if (!normalizedHash) return null
    return mapKnownAuthError(new URLSearchParams(normalizedHash))
}
