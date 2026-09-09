import { and, asc, eq, sql } from 'drizzle-orm';
import { db, schema } from '../db';
import { syncLinks } from './elements';
import { touchWorld } from './worlds';

const { events, links } = schema;

export function listEvents(worldId: string) {
	return db
		.select()
		.from(events)
		.where(eq(events.worldId, worldId))
		.orderBy(asc(events.sortKey), asc(events.createdAt))
		.all();
}

export function getEvent(worldId: string, id: string) {
	return db
		.select()
		.from(events)
		.where(and(eq(events.worldId, worldId), eq(events.id, id)))
		.get();
}

export interface EventInput {
	title: string;
	dateLabel?: string;
	sortKey?: number;
	era?: string;
	body?: string;
}

export function createEvent(worldId: string, input: EventInput) {
	const sortKey =
		input.sortKey ??
		(db
			.select({ m: sql<number>`coalesce(max(${events.sortKey}), 0)` })
			.from(events)
			.where(eq(events.worldId, worldId))
			.get()?.m ?? 0) + 1;
	const row = db
		.insert(events)
		.values({
			worldId,
			title: input.title.trim(),
			dateLabel: input.dateLabel ?? '',
			sortKey,
			era: input.era ?? '',
			body: input.body ?? ''
		})
		.returning()
		.get();
	syncLinks(worldId, 'event', row.id, row.body);
	touchWorld(worldId);
	return row;
}

export function updateEvent(worldId: string, id: string, input: EventInput) {
	const row = db
		.update(events)
		.set({
			title: input.title.trim(),
			dateLabel: input.dateLabel ?? '',
			sortKey: input.sortKey ?? 0,
			era: input.era ?? '',
			body: input.body ?? '',
			updatedAt: new Date()
		})
		.where(and(eq(events.worldId, worldId), eq(events.id, id)))
		.returning()
		.get();
	if (row) syncLinks(worldId, 'event', row.id, row.body);
	touchWorld(worldId);
	return row;
}

export function deleteEvent(worldId: string, id: string) {
	db.delete(links)
		.where(and(eq(links.sourceKind, 'event'), eq(links.sourceId, id)))
		.run();
	db.delete(events)
		.where(and(eq(events.worldId, worldId), eq(events.id, id)))
		.run();
}
