import { eq, inArray } from 'drizzle-orm';
import { db, schema } from '../db';
import { listTypes } from './worlds';
import { listEvents } from './timeline';
import { allRelationships } from './elements';

/** Full portable snapshot of a world, suitable for backup or migration. */
export function exportWorld(worldId: string) {
	const world = db.select().from(schema.worlds).where(eq(schema.worlds.id, worldId)).get();
	if (!world) return null;
	const types = listTypes(worldId);
	const elements = db
		.select()
		.from(schema.elements)
		.where(eq(schema.elements.worldId, worldId))
		.all();
	const manuscripts = db
		.select()
		.from(schema.manuscripts)
		.where(eq(schema.manuscripts.worldId, worldId))
		.all();
	const chapters =
		manuscripts.length === 0
			? []
			: db
					.select()
					.from(schema.chapters)
					.where(
						inArray(
							schema.chapters.manuscriptId,
							manuscripts.map((m) => m.id)
						)
					)
					.all();
	return {
		format: 'loreforge-world',
		version: 1,
		exportedAt: new Date().toISOString(),
		world,
		types,
		elements,
		relationships: allRelationships(worldId),
		events: listEvents(worldId),
		manuscripts,
		chapters
	};
}
