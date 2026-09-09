import { redirect, type Handle } from '@sveltejs/kit';
import { authConfig } from '$lib/server/auth/config';
import { resolveSession, SESSION_COOKIE, sessionCookieOptions } from '$lib/server/auth/session';

/** Paths reachable without a session. Static assets never reach this hook (served by the adapter). */
const PUBLIC = [/^\/healthz$/, /^\/login$/, /^\/auth\//, /^\/favicon/];

export const handle: Handle = async ({ event, resolve }) => {
	event.locals.user = null;
	event.locals.session = null;

	if (!authConfig.enabled) return resolve(event);

	const token = event.cookies.get(SESSION_COOKIE);
	if (token) {
		const hit = resolveSession(token);
		if (hit) {
			event.locals.user = hit.user;
			event.locals.session = hit.session;
		} else {
			event.cookies.delete(SESSION_COOKIE, sessionCookieOptions());
		}
	}

	const path = event.url.pathname;
	if (!event.locals.user && !PUBLIC.some((re) => re.test(path))) {
		if (event.request.method === 'GET' && !event.isDataRequest) {
			const next = path + event.url.search;
			redirect(303, `/login?next=${encodeURIComponent(next)}`);
		}
		return new Response('Unauthorized', { status: 401 });
	}

	const response = await resolve(event);
	if (event.locals.user) response.headers.set('cache-control', 'private, no-store');
	return response;
};
