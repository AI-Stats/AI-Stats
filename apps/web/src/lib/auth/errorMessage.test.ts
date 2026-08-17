import {
    buildAuthErrorRedirectUrl,
    classifyPostLoginError,
    normalizeAuthErrorMessage,
    resolveCallbackErrorMessage,
    resolveHashAuthErrorMessage,
} from './errorMessage'

describe('auth error helpers', () => {
    it('normalizes empty messages to the default copy', () => {
        expect(normalizeAuthErrorMessage('   ')).toBe('We could not complete the sign-in flow. Please try again.')
    })

    it('does not expose raw provider descriptions from query params', () => {
        const url = new URL('https://example.com/auth/callback?error=server_error&error_description=Database+error+saving+new+user')

        expect(resolveCallbackErrorMessage(url)).toBe('We could not complete the sign-in flow. Please try again.')
    })

    it('reads auth errors from URL fragments', () => {
        expect(resolveHashAuthErrorMessage('#error=server_error&error_description=Database+error+saving+new+user')).toBe(
            'We could not complete the sign-in flow. Please try again.'
        )
    })

    it('maps access_denied to a provider-agnostic message', () => {
        const url = new URL('https://example.com/auth/callback?error=access_denied')
        expect(resolveCallbackErrorMessage(url)).toBe('Sign-in was cancelled or denied. Please try again.')
    })

    it('maps SSO provider disabled errors to an explicit message', () => {
        const url = new URL('https://example.com/auth/callback?error_code=saml_provider_disabled')
        expect(resolveCallbackErrorMessage(url)).toBe('Enterprise SSO is configured but currently disabled.')
    })

    it('builds an error redirect URL with a sanitized message', () => {
        const redirectUrl = buildAuthErrorRedirectUrl('https://example.com/auth/callback', '  Detailed failure  ', 'workspace_setup_failed')

        expect(redirectUrl.pathname).toBe('/error')
        expect(redirectUrl.searchParams.get('message')).toBe('Detailed failure')
        expect(redirectUrl.searchParams.get('code')).toBe('workspace_setup_failed')
    })

    it('classifies post-login errors without exposing internal details', () => {
        expect(classifyPostLoginError(new Error("Cannot read properties of undefined (reading 'listFactors')"))).toEqual({
            code: 'security_check_failed',
            message: 'You are signed in, but Phaseo could not finish checking your account security settings. Please retry sign-in.',
        })
        expect(classifyPostLoginError(new Error('provision_personal_workspace_failed'))).toMatchObject({
            code: 'workspace_setup_failed',
        })
    })
})
