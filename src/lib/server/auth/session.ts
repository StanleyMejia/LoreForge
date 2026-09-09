import { createHash, randomBytes } from 'node:crypto';
import { and, eq, gt, lt } from 'drizzle-orm';
import { db, schema } from '../db';
import { authConfig } from './config';

const { sessions, users } = schema;

export const SESSION_COOKIE = 'lf_session';
export const LOGIN_STATE_COOKIE = 'lf_oidc';

export interface SessionUser {
	id: string;
	email: string;
	name: string;
	picture: string;
}

const secure = authConfig.origin.startsWith('https://');

export const sessionCookieOptions = () => ({
	path: '/',
	httpOnly: true,
	sameSite: 'lax' as const,
	secure,
	maxAge: Math.floor(authConfig.sessionTtlMs / 1000)
});

export const loginStateCookieOptions = () => ({
	path: '/',
	httpOnly: true,
	sameSite: 'lax' as const,
	secure,
	maxAge: 600
});

const hash = (token: string) => createHash('sha256').update(token).digest('base64url');

/** Create a session for a user; returns the raw token for the cookie. */
export function createSession(userId: string, idToken = ''): string {
	const token = randomBytes(32).toString('base64url');
	db.insert(sessions)
		.values({
			id: hash(token),
			userId,
			idToken,
			expiresAt: new Date(Date.now() + authConfig.sessionTtlMs)
		})
		.run();
	// Opportunistic cleanup of expired sessions.
	db.delete(sessions).where(lt(sessions.expiresAt, new Date())).run();
	return token;
}

/** Resolve a cookie token to its user, sliding the expiry when past the halfway mark. */
export function resolveSession(token: string) {
	const id = hash(token);
	const row = db
		.select({
			sessionId: sessions.id,
			idToken: sessions.idToken,
			expiresAt: sessions.expiresAt,
			user: { id: users.id, email: users.email, name: users.name, picture: users.picture }
		})
		.from(sessions)
		.innerJoin(users, eq(users.id, sessions.userId))
		.where(and(eq(sessions.id, id), gt(sessions.expiresAt, new Date())))
		.get();
	if (!row) return null;
	const remaining = row.expiresAt.getTime() - Date.now();
	if (remaining < authConfig.sessionTtlMs / 2) {
		db.update(sessions)
			.set({ expiresAt: new Date(Date.now() + authConfig.sessionTtlMs) })
			.where(eq(sessions.id, id))
			.run();
	}
	return {
		session: { id: row.sessionId, idToken: row.idToken, expiresAt: row.expiresAt },
		user: row.user
	};
}

export function deleteSession(token: string) {
	db.delete(sessions)
		.where(eq(sessions.id, hash(token)))
		.run();
}
