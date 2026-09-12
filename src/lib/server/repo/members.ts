import { and, asc, count, desc, eq, gt, isNull, sql } from 'drizzle-orm';
import { db, schema } from '../db';
import { WORLD_ROLES, type WorldRole } from '../db/schema';

const { worlds, worldMembers, worldInvites, users, elements } = schema;

export const isRole = (v: unknown): v is WorldRole =>
	(WORLD_ROLES as readonly string[]).includes(String(v));
export const canEdit = (r: WorldRole | null) => r === 'owner' || r === 'editor';

/** The signed-in user's role in a world, or null if they are not a member. */
export function roleFor(worldId: string, userId: string): WorldRole | null {
	const row = db
		.select({ role: worldMembers.role })
		.from(worldMembers)
		.where(and(eq(worldMembers.worldId, worldId), eq(worldMembers.userId, userId)))
		.get();
	return row?.role ?? null;
}

function memberCount(worldId: string): number {
	return (
		db.select({ n: count() }).from(worldMembers).where(eq(worldMembers.worldId, worldId)).get()
			?.n ?? 0
	);
}

const worldCols = {
	id: worlds.id,
	slug: worlds.slug,
	name: worlds.name,
	description: worlds.description,
	updatedAt: worlds.updatedAt,
	elementCount:
		sql<number>`(select count(*) from ${elements} e where e.world_id = ${worlds.id})`.mapWith(
			Number
		)
};

/** Worlds grouped by the user's relationship to them. */
export function listWorldsFor(userId: string) {
	const mine = db
		.select({ ...worldCols, role: worldMembers.role })
		.from(worldMembers)
		.innerJoin(worlds, eq(worlds.id, worldMembers.worldId))
		.where(eq(worldMembers.userId, userId))
		.orderBy(desc(worlds.updatedAt))
		.all();
	// Worlds without any member: created before auth was enabled. Anyone may claim them.
	const unclaimed = db
		.select(worldCols)
		.from(worlds)
		.where(sql`not exists (select 1 from ${worldMembers} m where m.world_id = ${worlds.id})`)
		.orderBy(desc(worlds.updatedAt))
		.all();
	return {
		owned: mine.filter((w) => w.role === 'owner'),
		shared: mine.filter((w) => w.role !== 'owner'),
		unclaimed
	};
}

/** Make `userId` the owner of a world that has no members yet. */
export function claimWorld(worldId: string, userId: string, email: string): boolean {
	if (memberCount(worldId) > 0) return false;
	db.insert(worldMembers)
		.values({ worldId, userId, email: email || `user:${userId}`, role: 'owner' })
		.run();
	return true;
}

interface MemberView {
	id: string;
	email: string;
	name: string;
	role: WorldRole;
	pending: boolean;
	isSelf: boolean;
}

export function listMembers(worldId: string, selfId: string): MemberView[] {
	return db
		.select({
			id: worldMembers.id,
			email: worldMembers.email,
			role: worldMembers.role,
			userId: worldMembers.userId,
			name: users.name
		})
		.from(worldMembers)
		.leftJoin(users, eq(users.id, worldMembers.userId))
		.where(eq(worldMembers.worldId, worldId))
		.orderBy(asc(worldMembers.createdAt))
		.all()
		.map((m) => ({
			id: m.id,
			email: m.email,
			name: m.name ?? '',
			role: m.role,
			pending: !m.userId,
			isSelf: m.userId === selfId
		}));
}

/** Share with a person by email. If they already have an account the share is live immediately. */
export function shareByEmail(
	worldId: string,
	rawEmail: string,
	role: WorldRole
): { ok: true } | { ok: false; error: string } {
	const email = rawEmail.trim().toLowerCase();
	if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
		return { ok: false, error: 'Enter a valid email address.' };
	if (role === 'owner') return { ok: false, error: 'Ownership cannot be shared.' };
	const existing = db
		.select({ id: worldMembers.id, role: worldMembers.role })
		.from(worldMembers)
		.where(and(eq(worldMembers.worldId, worldId), eq(worldMembers.email, email)))
		.get();
	if (existing) {
		if (existing.role === 'owner') return { ok: false, error: 'That person owns this world.' };
		db.update(worldMembers).set({ role }).where(eq(worldMembers.id, existing.id)).run();
		return { ok: true };
	}
	const user = db.select({ id: users.id }).from(users).where(eq(users.email, email)).get();
	db.insert(worldMembers)
		.values({ worldId, userId: user?.id ?? null, email, role })
		.run();
	return { ok: true };
}

export function setMemberRole(worldId: string, memberId: string, role: WorldRole) {
	if (role === 'owner') return;
	db.update(worldMembers)
		.set({ role })
		.where(
			and(
				eq(worldMembers.id, memberId),
				eq(worldMembers.worldId, worldId),
				sql`${worldMembers.role} != 'owner'`
			)
		)
		.run();
}

export function removeMember(worldId: string, memberId: string) {
	db.delete(worldMembers)
		.where(
			and(
				eq(worldMembers.id, memberId),
				eq(worldMembers.worldId, worldId),
				sql`${worldMembers.role} != 'owner'`
			)
		)
		.run();
}

/** Attach pending email shares to a user who just signed in. */
export function claimPendingShares(userId: string, email: string) {
	if (!email) return;
	db.update(worldMembers)
		.set({ userId })
		.where(and(isNull(worldMembers.userId), eq(worldMembers.email, email.toLowerCase())))
		.run();
}

// ---- invite links -----------------------------------------------------------

export function createInvite(worldId: string, role: WorldRole, createdBy: string, days = 7) {
	if (role === 'owner') role = 'editor';
	return db
		.insert(worldInvites)
		.values({ worldId, role, createdBy, expiresAt: new Date(Date.now() + days * 86_400_000) })
		.returning()
		.get();
}

export function listInvites(worldId: string) {
	return db
		.select()
		.from(worldInvites)
		.where(and(eq(worldInvites.worldId, worldId), gt(worldInvites.expiresAt, new Date())))
		.orderBy(desc(worldInvites.createdAt))
		.all();
}

export function revokeInvite(worldId: string, id: string) {
	db.delete(worldInvites)
		.where(and(eq(worldInvites.id, id), eq(worldInvites.worldId, worldId)))
		.run();
}

/** Redeem an invite for a signed-in user. Returns the world slug or null if invalid/expired. */
export function acceptInvite(
	token: string,
	userId: string,
	email: string
): { slug: string; role: WorldRole } | null {
	const inv = db
		.select({
			id: worldInvites.id,
			worldId: worldInvites.worldId,
			role: worldInvites.role,
			slug: worlds.slug
		})
		.from(worldInvites)
		.innerJoin(worlds, eq(worlds.id, worldInvites.worldId))
		.where(and(eq(worldInvites.id, token), gt(worldInvites.expiresAt, new Date())))
		.get();
	if (!inv) return null;
	const current = roleFor(inv.worldId, userId);
	const rank: Record<WorldRole, number> = { viewer: 0, editor: 1, owner: 2 };
	if (!current) {
		db.insert(worldMembers)
			.values({ worldId: inv.worldId, userId, email: email || `user:${userId}`, role: inv.role })
			.onConflictDoUpdate({
				target: [worldMembers.worldId, worldMembers.email],
				set: { userId, role: inv.role }
			})
			.run();
	} else if (rank[inv.role] > rank[current]) {
		db.update(worldMembers)
			.set({ role: inv.role })
			.where(and(eq(worldMembers.worldId, inv.worldId), eq(worldMembers.userId, userId)))
			.run();
	}
	db.update(worldInvites)
		.set({ uses: sql`${worldInvites.uses} + 1` })
		.where(eq(worldInvites.id, inv.id))
		.run();
	return { slug: inv.slug, role: inv.role };
}
