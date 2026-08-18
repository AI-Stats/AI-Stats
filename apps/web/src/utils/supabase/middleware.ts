import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { canUpgradeCookieAuth } from './cookieAuthRequest'

export async function updateSession(request: NextRequest) {
    const forwardedHeaders = new Headers(request.headers)
    let supabaseResponse = NextResponse.next({
        request: { headers: forwardedHeaders },
    })
    const pathname = request.nextUrl.pathname

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll: () => request.cookies.getAll(),
                setAll: (cookiesToSet: Array<{ name: string; value: string; options?: CookieOptions }>) => {
                    cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
                    supabaseResponse = NextResponse.next({
                        request: { headers: forwardedHeaders },
                    })
                    cookiesToSet.forEach(({ name, value, options }) =>
                        supabaseResponse.cookies.set(name, value, options)
                    )
                },
            },
        }
    )

    const [
        { data: { user } },
        { data: { session } },
    ] = await Promise.all([
        supabase.auth.getUser(),
        supabase.auth.getSession(),
    ])

    const isPrivateWebApiRequest =
        pathname.startsWith('/api/account/') ||
        pathname.startsWith('/api/chat/') ||
        pathname.startsWith('/api/internal/')
    if (isPrivateWebApiRequest) {
        const activeWorkspaceId = request.cookies.get('activeWorkspaceId')?.value
        forwardedHeaders.delete('cookie')
        if (activeWorkspaceId) {
            forwardedHeaders.set(
                'cookie',
                `activeWorkspaceId=${encodeURIComponent(activeWorkspaceId)}`
            )
        }
    }
    if (
        isPrivateWebApiRequest &&
        session?.access_token &&
        canUpgradeCookieAuth(request.headers, request.nextUrl.origin) &&
        !forwardedHeaders.has('authorization')
    ) {
        const responseCookies = supabaseResponse.cookies.getAll()
        forwardedHeaders.set('authorization', `Bearer ${session.access_token}`)
        supabaseResponse = NextResponse.next({
            request: { headers: forwardedHeaders },
        })
        responseCookies.forEach((cookie) => supabaseResponse.cookies.set(cookie))
    }

    // Keep strict auth-gate behavior for settings pages only.
    if (!user && pathname.startsWith('/settings')) {
        const url = request.nextUrl.clone()
        url.pathname = '/sign-in'
        url.searchParams.set('returnUrl', request.nextUrl.pathname + request.nextUrl.search)
        return NextResponse.redirect(url)
    }

    if (user) {
        const [{ data: factorsData }, { data: aalData }] = await Promise.all([
            supabase.auth.mfa.listFactors(),
            supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
        ])
        const hasVerifiedFactor = Object.values(factorsData ?? {}).some((factors) =>
            Array.isArray(factors) && factors.some((factor) => factor.status === 'verified')
        )
        const mustVerifyMfa =
            hasVerifiedFactor &&
            aalData?.currentLevel === 'aal1' &&
            aalData?.nextLevel === 'aal2'

        if (mustVerifyMfa) {
            const url = request.nextUrl.clone()
            url.pathname = '/auth/verify-mfa'
            url.searchParams.set('returnUrl', pathname + request.nextUrl.search)
            return NextResponse.redirect(url)
        }
    }

    return supabaseResponse
}
