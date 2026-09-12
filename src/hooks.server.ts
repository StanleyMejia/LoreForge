import { error, redirect, type Handle } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { authConfig } from '$lib/server/auth/config';
import { resolveSession, SESSION_COOKIE, sessionCookieOptions } from '$lib/server/auth/session';
import { getWorldBySlug } from '$lib/server/repo/worlds';
import { getChapterInWorld } from '$lib/server/repo/manuscripts';
import { canEdit, roleFor } from '$lib/server/repo/members';
import { hit as countRequest, sweep, type Window } from '$lib/server/ratelimit';

/** Paths reachable without a session. Static assets never reach this hook (served by the adapter). */
const PUBLIC = [/^\/healthz$/, /^\/login$/, /^\/auth\//, /^\/favicon/];
/** Pages inside a world that only editors may open. */
const EDIT_PAGES = [/\/e\/new$/, /\/edit$/, /\/settings$/];

/**
 * Sign-in rate limits, keyed by client address.
 *
 * `/login` is only a page render, so its allowance is loose. `/auth/login` and `/auth/callback`
 * each make an outbound request to the identity provider — discovery and a token exchange — so
 * they are what actually needs slowing down.
 *
 * These depend on seeing the real client address. Behind a reverse proxy that means setting
 * ADDRESS_HEADER (see README); without it every request looks like the proxy and shares one
 * bucket, so the limits are set high enough that a misconfigured instance still works for a
 * household while an abusive client is throttled.
 */
const SIGNIN_LIMITS: { path: RegExp; limit: number; windowMs: number; page: boolean }[] = [
	{ path: /^\/auth\/(login|callback)$/, limit: 20, windowMs: 60_000, page: false },
	{ path: /^\/login$/, limit: 60, windowMs: 60_000, page: true }
];
const signinHits = new Map<string, Window>();

// A proxy header is configured but the address header is not, which means getClientAddress()
// reports the proxy for everyone and the limits above become one shared bucket. Worth saying out
// loud at boot, because nothing else about the instance looks wrong.
if (authConfig.enabled && (env.PROTOCOL_HEADER || env.HOST_HEADER) && !env.ADDRESS_HEADER) {
	console.warn(
		'[auth] ADDRESS_HEADER is not set while proxy headers are: sign-in rate limits will be shared by all clients. Set ADDRESS_HEADER=x-forwarded-for (and XFF_DEPTH) to key them per client.'
	);
}

function signinLimit(event: Parameters<Handle>[0]['event']): Response | undefined {
	const path = event.url.pathname;
	const rule = SIGNIN_LIMITS.find((r) => r.path.test(path));
	if (!rule) return;
	if (signinHits.size > 5000) sweep(signinHits);
	const { ok, retryAfter } = countRequest(
		signinHits,
		`${rule.path.source}:${event.getClientAddress()}`,
		rule.limit,
		rule.windowMs
	);
	if (ok) return;
	if (rule.page) error(429, `Too many sign-in attempts. Try again in ${retryAfter} seconds.`);
	return new Response('Too many requests', {
		status: 429,
		headers: { 'retry-after': String(retryAfter) }
	});
}

export const handle: Handle = async ({ event, resolve }) => {
	event.locals.user = null;
	event.locals.session = null;
	event.locals.world = null;

	if (authConfig.enabled) {
		// Before anything else: an unauthenticated caller must not be able to make us hammer the
		// identity provider.
		const limited = signinLimit(event);
		if (limited) return limited;

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
				redirect(303, `/login?next=${encodeURIComponent(path + event.url.search)}`);
			}
			return new Response('Unauthorized', { status: 401 });
		}
	}

	// World access control, enforced once for every route under /w/[slug].
	const m = /^\/w\/([^/]+)(\/.*)?$/.exec(event.url.pathname);
	if (m) {
		const world = getWorldBySlug(decodeURIComponent(m[1]));
		if (!world) error(404, 'World not found');
		const role = authConfig.enabled ? roleFor(world.id, event.locals.user!.id) : 'owner';
		if (!role) error(404, 'World not found');
		event.locals.world = { id: world.id, slug: world.slug, role };
		const mutating = !['GET', 'HEAD', 'OPTIONS'].includes(event.request.method);
		if (!canEdit(role)) {
			if (mutating) error(403, 'You have view-only access to this world');
			const rest = m[2] ?? '';
			if (EDIT_PAGES.some((re) => re.test(rest)))
				error(403, 'You have view-only access to this world');
			// Viewers opening a chapter editor are sent to the read-through view instead.
			const ch = /^\/m\/([^/]+)\/c\/([^/]+)$/.exec(rest);
			if (ch) redirect(303, `/w/${world.slug}/m/${ch[1]}/read#ch-${ch[2]}`);
			const wr = /^\/write\/([^/]+)$/.exec(rest);
			if (wr) {
				const chapter = getChapterInWorld(world.id, wr[1]);
				redirect(
					303,
					chapter
						? `/w/${world.slug}/m/${chapter.manuscriptId}/read#ch-${chapter.id}`
						: `/w/${world.slug}/manuscripts`
				);
			}
		}
	}

	const response = await resolve(event);
	if (event.locals.user) response.headers.set('cache-control', 'private, no-store');
	return response;
};
