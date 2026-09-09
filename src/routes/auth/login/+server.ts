import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { authConfig } from '$lib/server/auth/config';
import { beginLogin } from '$lib/server/auth/oidc';
import { LOGIN_STATE_COOKIE, loginStateCookieOptions } from '$lib/server/auth/session';

/** Start the OIDC Authorization Code + PKCE flow. */
export const GET: RequestHandler = async ({ url, cookies, locals }) => {
	if (!authConfig.enabled || locals.user) redirect(303, '/');
	const rawNext = url.searchParams.get('next') ?? '/';
	const next = rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '/';
	let started;
	try {
		started = await beginLogin(next);
	} catch (e) {
		console.error('[auth] discovery/login failed:', e);
		redirect(303, '/login?error=config');
	}
	cookies.set(LOGIN_STATE_COOKIE, started.cookie, loginStateCookieOptions());
	redirect(302, started.url);
};
