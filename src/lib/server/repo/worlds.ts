import { and, asc, count, desc, eq, sql } from 'drizzle-orm';
import { db, schema } from '../db';
import { DEFAULT_TYPES } from '$lib/defaults';
import { slugify } from '$lib/slug';
import { removeWorldDir } from '../uploads';

const { worlds, elementTypes, elements } = schema;

export function listWorlds() {
	return db
		.select({
			id: worlds.id,
			slug: worlds.slug,
			name: worlds.name,
			description: worlds.description,
			updatedAt: worlds.updatedAt,
			elementCount: count(elements.id)
		})
		.from(worlds)
		.leftJoin(elements, eq(elements.worldId, worlds.id))
		.groupBy(worlds.id)
		.orderBy(desc(worlds.updatedAt))
		.all();
}

export function getWorldBySlug(slug: string) {
	return db.select().from(worlds).where(eq(worlds.slug, slug)).get();
}

function uniqueWorldSlug(name: string): string {
	const base = slugify(name);
	let slug = base;
	for (
		let i = 2;
		db.select({ id: worlds.id }).from(worlds).where(eq(worlds.slug, slug)).get();
		i++
	) {
		slug = `${base}-${i}`;
	}
	return slug;
}

export function createWorld(name: string, description = '', owner?: { id: string; email: string }) {
	return db.transaction((tx) => {
		const world = tx
			.insert(worlds)
			.values({ name, description, slug: uniqueWorldSlug(name) })
			.returning()
			.get();
		if (owner) {
			tx.insert(schema.worldMembers)
				.values({
					worldId: world.id,
					userId: owner.id,
					email: owner.email || `user:${owner.id}`,
					role: 'owner'
				})
				.run();
		}
		tx.insert(elementTypes)
			.values(
				DEFAULT_TYPES.map((t, i) => ({
					worldId: world.id,
					key: t.key,
					name: t.name,
					singular: t.singular,
					icon: t.icon,
					color: t.color,
					panels: t.panels,
					sortOrder: i
				}))
			)
			.run();
		return world;
	});
}

export function updateWorld(id: string, patch: { name?: string; description?: string }) {
	return db
		.update(worlds)
		.set({ ...patch, updatedAt: new Date() })
		.where(eq(worlds.id, id))
		.returning()
		.get();
}

export function touchWorld(id: string) {
	db.update(worlds).set({ updatedAt: new Date() }).where(eq(worlds.id, id)).run();
}

export function deleteWorld(id: string) {
	db.delete(worlds).where(eq(worlds.id, id)).run();
	removeWorldDir(id);
}

// ---- element types -------------------------------------------------------

export function listTypes(worldId: string) {
	return db
		.select()
		.from(elementTypes)
		.where(eq(elementTypes.worldId, worldId))
		.orderBy(asc(elementTypes.sortOrder), asc(elementTypes.name))
		.all();
}

export function listTypesWithCounts(worldId: string) {
	return db
		.select({
			id: elementTypes.id,
			key: elementTypes.key,
			name: elementTypes.name,
			singular: elementTypes.singular,
			icon: elementTypes.icon,
			color: elementTypes.color,
			sortOrder: elementTypes.sortOrder,
			panels: elementTypes.panels,
			count: count(elements.id)
		})
		.from(elementTypes)
		.leftJoin(elements, eq(elements.typeId, elementTypes.id))
		.where(eq(elementTypes.worldId, worldId))
		.groupBy(elementTypes.id)
		.orderBy(asc(elementTypes.sortOrder), asc(elementTypes.name))
		.all();
}

export function getType(worldId: string, key: string) {
	return db
		.select()
		.from(elementTypes)
		.where(and(eq(elementTypes.worldId, worldId), eq(elementTypes.key, key)))
		.get();
}

export function getTypeById(id: string) {
	return db.select().from(elementTypes).where(eq(elementTypes.id, id)).get();
}

export function createType(
	worldId: string,
	input: { name: string; singular: string; icon: string; color: string }
) {
	const base = slugify(input.singular || input.name);
	let key = base;
	for (let i = 2; getType(worldId, key); i++) key = `${base}-${i}`;
	const max =
		db
			.select({ m: sql<number>`coalesce(max(${elementTypes.sortOrder}), -1)` })
			.from(elementTypes)
			.where(eq(elementTypes.worldId, worldId))
			.get()?.m ?? -1;
	return db
		.insert(elementTypes)
		.values({
			worldId,
			key,
			...input,
			sortOrder: max + 1,
			panels: [
				{ id: 'basic', kind: 'info', title: 'Basic Information', fields: [], values: {} },
				{ id: 'overview', kind: 'text', title: 'Overview', body: '' }
			]
		})
		.returning()
		.get();
}

export function updateType(
	id: string,
	patch: Partial<
		Pick<
			typeof elementTypes.$inferInsert,
			'name' | 'singular' | 'icon' | 'color' | 'panels' | 'sortOrder'
		>
	>
) {
	return db.update(elementTypes).set(patch).where(eq(elementTypes.id, id)).returning().get();
}

export function deleteType(id: string) {
	db.delete(elementTypes).where(eq(elementTypes.id, id)).run();
}
