import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { authConfig } from '$lib/server/auth/config';
import { endSessionUrl } from '$lib/server/auth/oidc';
import { deleteSession, SESSION_COOKIE, sessionCookieOptions } from '$lib/server/auth/session';

/** POST only (CSRF: SvelteKit rejects cross-origin form posts). Ends the local session, then the provider's. */
export const POST: RequestHandler = async ({ cookies, locals }) => {
	const token = cookies.get(SESSION_COOKIE);
	const idToken = locals.session?.idToken ?? '';
	if (token) deleteSession(token);
	cookies.delete(SESSION_COOKIE, sessionCookieOptions());
	if (!authConfig.enabled) redirect(303, '/');
	const upstream = await endSessionUrl(idToken).catch(() => null);
	redirect(303, upstream ?? '/login');
};
