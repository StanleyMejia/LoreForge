import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { authConfig } from '$lib/server/auth/config';
import { completeLogin, LoginDeniedError, LoginStateError } from '$lib/server/auth/oidc';
import {
	createSession,
	LOGIN_STATE_COOKIE,
	loginStateCookieOptions,
	SESSION_COOKIE,
	sessionCookieOptions
} from '$lib/server/auth/session';
import { upsertUser } from '$lib/server/repo/users';

/** OIDC redirect target: exchange the code, verify identity, open a session. */
export const GET: RequestHandler = async ({ url, cookies }) => {
	if (!authConfig.enabled) redirect(303, '/');
	const state = cookies.get(LOGIN_STATE_COOKIE) ?? '';
	cookies.delete(LOGIN_STATE_COOKIE, loginStateCookieOptions());

	let result;
	try {
		result = await completeLogin(url, state);
	} catch (e) {
		if (e instanceof LoginStateError) redirect(303, '/login?error=state');
		if (e instanceof LoginDeniedError) {
			console.warn(`[auth] denied: ${e.message}`);
			redirect(303, '/login?error=denied');
		}
		console.error('[auth] callback failed:', e);
		redirect(303, '/login?error=provider');
	}

	const user = upsertUser(result.profile);
	const token = createSession(user.id, result.idToken);
	cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
	redirect(303, result.next);
};
