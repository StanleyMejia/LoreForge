import { and, asc, desc, eq, sql } from 'drizzle-orm';
import { db, schema } from '../db';
import { removeFile, storeFile } from '../uploads';

const { uploads, elements, events, chapters, manuscripts, revisions } = schema;

export async function createUpload(input: {
	worldId: string;
	filename: string;
	mime: string;
	ext: string;
	data: Uint8Array;
	createdBy: string | null;
}) {
	const id = crypto.randomUUID();
	const storagePath = await storeFile(input.worldId, id, input.ext, input.data);
	return db
		.insert(uploads)
		.values({
			id,
			worldId: input.worldId,
			filename: input.filename.slice(0, 200) || `image.${input.ext}`,
			mime: input.mime,
			size: input.data.byteLength,
			storagePath,
			createdBy: input.createdBy
		})
		.returning()
		.get();
}

export function getUpload(worldId: string, id: string) {
	return db
		.select()
		.from(uploads)
		.where(and(eq(uploads.worldId, worldId), eq(uploads.id, id)))
		.get();
}

export async function deleteUpload(worldId: string, id: string) {
	const row = getUpload(worldId, id);
	if (!row) return false;
	db.delete(uploads).where(eq(uploads.id, id)).run();
	await removeFile(row.storagePath);
	return true;
}

interface UploadUsage {
	id: string;
	filename: string;
	mime: string;
	size: number;
	createdAt: Date;
	referenced: boolean;
}

/** Every upload of a world, flagged by whether any content still points at `files/<id>`. */
export function listUploads(worldId: string): UploadUsage[] {
	const rows = db
		.select()
		.from(uploads)
		.where(eq(uploads.worldId, worldId))
		.orderBy(desc(uploads.createdAt))
		.all();
	return rows.map((u) => {
		const needle = `%files/${u.id}%`;
		const referenced =
			!!db
				.select({ id: elements.id })
				.from(elements)
				.where(
					and(
						eq(elements.worldId, worldId),
						sql`(${elements.panels} like ${needle} or ${elements.imageUrl} like ${needle})`
					)
				)
				.get() ||
			!!db
				.select({ id: events.id })
				.from(events)
				.where(and(eq(events.worldId, worldId), sql`${events.body} like ${needle}`))
				.get() ||
			!!db
				.select({ id: chapters.id })
				.from(chapters)
				.innerJoin(manuscripts, eq(manuscripts.id, chapters.manuscriptId))
				.where(and(eq(manuscripts.worldId, worldId), sql`${chapters.body} like ${needle}`))
				.get() ||
			// A revision pins the images it preserves; pruning the revision releases them again.
			// ponytail: a like scan per upload, the same order as the elements scan above.
			// Upgrade path: a derived upload_refs table if the settings page gets slow.
			!!db
				.select({ id: revisions.id })
				.from(revisions)
				.where(and(eq(revisions.worldId, worldId), sql`${revisions.content} like ${needle}`))
				.get();
		return {
			id: u.id,
			filename: u.filename,
			mime: u.mime,
			size: u.size,
			createdAt: u.createdAt,
			referenced
		};
	});
}

export function allUploads(worldId: string) {
	return db
		.select()
		.from(uploads)
		.where(eq(uploads.worldId, worldId))
		.orderBy(asc(uploads.createdAt))
		.all();
}
