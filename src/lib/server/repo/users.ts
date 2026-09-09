import { and, eq } from 'drizzle-orm';
import { db, schema } from '../db';
import type { Profile } from '../auth/profile';
import { claimPendingShares } from './members';

const { users } = schema;

/**
 * Find-or-create by (issuer, subject); refresh profile fields on every login and attach any
 * world shares that were addressed to this email before the person first signed in.
 */
export function upsertUser(p: Profile) {
	const existing = db
		.select()
		.from(users)
		.where(and(eq(users.issuer, p.issuer), eq(users.subject, p.subject)))
		.get();
	const user = existing
		? db
				.update(users)
				.set({ email: p.email, name: p.name, picture: p.picture, lastLoginAt: new Date() })
				.where(eq(users.id, existing.id))
				.returning()
				.get()
		: db
				.insert(users)
				.values({
					issuer: p.issuer,
					subject: p.subject,
					email: p.email,
					name: p.name,
					picture: p.picture
				})
				.returning()
				.get();
	claimPendingShares(user.id, user.email);
	return user;
}
