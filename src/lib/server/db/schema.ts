import { sql } from 'drizzle-orm';
import {
	index,
	integer,
	real,
	sqliteTable,
	text,
	uniqueIndex,
	type AnySQLiteColumn
} from 'drizzle-orm/sqlite-core';
import type { Panel } from '$lib/types';

const id = () =>
	text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID());
const now = () =>
	integer('created_at', { mode: 'timestamp_ms' })
		.notNull()
		.default(sql`(unixepoch('subsec') * 1000)`);
const updated = () =>
	integer('updated_at', { mode: 'timestamp_ms' })
		.notNull()
		.default(sql`(unixepoch('subsec') * 1000)`);

export const worlds = sqliteTable('worlds', {
	id: id(),
	slug: text('slug').notNull().unique(),
	name: text('name').notNull(),
	description: text('description').notNull().default(''),
	createdAt: now(),
	updatedAt: updated()
});

/** A category of element (Characters, Locations, ...). Field schema is per type. */
export const elementTypes = sqliteTable(
	'element_types',
	{
		id: id(),
		worldId: text('world_id')
			.notNull()
			.references(() => worlds.id, { onDelete: 'cascade' }),
		key: text('key').notNull(), // url-safe, unique per world
		name: text('name').notNull(), // plural display name, e.g. "Characters"
		singular: text('singular').notNull(), // e.g. "Character"
		icon: text('icon').notNull().default('📄'),
		color: text('color').notNull().default('#94a3b8'),
		sortOrder: integer('sort_order').notNull().default(0),
		/** Panel template applied to new elements of this type. */
		panels: text('panels', { mode: 'json' }).notNull().$type<Panel[]>().default([])
	},
	(t) => [uniqueIndex('element_types_world_key').on(t.worldId, t.key)]
);

export const elements = sqliteTable(
	'elements',
	{
		id: id(),
		worldId: text('world_id')
			.notNull()
			.references(() => worlds.id, { onDelete: 'cascade' }),
		typeId: text('type_id')
			.notNull()
			.references(() => elementTypes.id, { onDelete: 'cascade' }),
		slug: text('slug').notNull(),
		name: text('name').notNull(),
		summary: text('summary').notNull().default(''),
		panels: text('panels', { mode: 'json' }).notNull().$type<Panel[]>().default([]),
		tags: text('tags', { mode: 'json' }).notNull().$type<string[]>().default([]),
		imageUrl: text('image_url').notNull().default(''),
		/** Containment: the element this one sits inside. Cleared, not cascaded, on delete. */
		parentId: text('parent_id').references((): AnySQLiteColumn => elements.id, {
			onDelete: 'set null'
		}),
		createdAt: now(),
		updatedAt: updated()
	},
	(t) => [
		uniqueIndex('elements_world_slug').on(t.worldId, t.slug),
		index('elements_world_type').on(t.worldId, t.typeId),
		index('elements_world_name').on(t.worldId, t.name),
		index('elements_world_parent').on(t.worldId, t.parentId)
	]
);

/** Explicit, labelled relationship between two elements ("mentor of" / "student of"). */
export const relationships = sqliteTable(
	'relationships',
	{
		id: id(),
		worldId: text('world_id')
			.notNull()
			.references(() => worlds.id, { onDelete: 'cascade' }),
		fromId: text('from_id')
			.notNull()
			.references(() => elements.id, { onDelete: 'cascade' }),
		toId: text('to_id')
			.notNull()
			.references(() => elements.id, { onDelete: 'cascade' }),
		label: text('label').notNull(),
		reverseLabel: text('reverse_label').notNull().default(''),
		notes: text('notes').notNull().default(''),
		createdAt: now()
	},
	(t) => [index('relationships_from').on(t.fromId), index('relationships_to').on(t.toId)]
);

/**
 * Implicit links extracted from [[wiki links]] in markdown bodies. Recomputed on save.
 * sourceKind: 'element' | 'event' | 'chapter'
 */
export const links = sqliteTable(
	'links',
	{
		worldId: text('world_id')
			.notNull()
			.references(() => worlds.id, { onDelete: 'cascade' }),
		sourceKind: text('source_kind').notNull(),
		sourceId: text('source_id').notNull(),
		targetId: text('target_id')
			.notNull()
			.references(() => elements.id, { onDelete: 'cascade' })
	},
	(t) => [
		index('links_target').on(t.targetId),
		index('links_source').on(t.sourceKind, t.sourceId),
		uniqueIndex('links_unique').on(t.sourceKind, t.sourceId, t.targetId)
	]
);

export const events = sqliteTable(
	'events',
	{
		id: id(),
		worldId: text('world_id')
			.notNull()
			.references(() => worlds.id, { onDelete: 'cascade' }),
		title: text('title').notNull(),
		dateLabel: text('date_label').notNull().default(''), // "3rd of Harvest, 1042 AE"
		sortKey: real('sort_key').notNull().default(0), // numeric position on the timeline
		era: text('era').notNull().default(''),
		body: text('body').notNull().default(''),
		createdAt: now(),
		updatedAt: updated()
	},
	(t) => [index('events_world_sort').on(t.worldId, t.sortKey)]
);

export const manuscripts = sqliteTable('manuscripts', {
	id: id(),
	worldId: text('world_id')
		.notNull()
		.references(() => worlds.id, { onDelete: 'cascade' }),
	title: text('title').notNull(),
	description: text('description').notNull().default(''),
	sortOrder: integer('sort_order').notNull().default(0),
	createdAt: now(),
	updatedAt: updated()
});

export const chapters = sqliteTable(
	'chapters',
	{
		id: id(),
		manuscriptId: text('manuscript_id')
			.notNull()
			.references(() => manuscripts.id, { onDelete: 'cascade' }),
		title: text('title').notNull(),
		synopsis: text('synopsis').notNull().default(''),
		body: text('body').notNull().default(''),
		status: text('status').notNull().default('draft'), // draft | revised | final
		wordCount: integer('word_count').notNull().default(0),
		sortOrder: integer('sort_order').notNull().default(0),
		/** Timeline event this chapter takes place at (optional). */
		eventId: text('event_id').references(() => events.id, { onDelete: 'set null' }),
		createdAt: now(),
		updatedAt: updated()
	},
	(t) => [index('chapters_manuscript_sort').on(t.manuscriptId, t.sortOrder)]
);

/**
 * Structured cross-references from a chapter to world elements.
 * role: 'pov' (point-of-view character) | 'location' | 'cast' (present in the chapter).
 * Text mentions ([[links]]) are tracked separately in `links` with sourceKind 'chapter'.
 */
export const chapterRefs = sqliteTable(
	'chapter_refs',
	{
		id: id(),
		chapterId: text('chapter_id')
			.notNull()
			.references(() => chapters.id, { onDelete: 'cascade' }),
		elementId: text('element_id')
			.notNull()
			.references(() => elements.id, { onDelete: 'cascade' }),
		role: text('role').notNull(),
		note: text('note').notNull().default(''),
		sortOrder: integer('sort_order').notNull().default(0)
	},
	(t) => [
		uniqueIndex('chapter_refs_unique').on(t.chapterId, t.elementId, t.role),
		index('chapter_refs_element').on(t.elementId)
	]
);

export type World = typeof worlds.$inferSelect;
export type Element = typeof elements.$inferSelect;
export type Relationship = typeof relationships.$inferSelect;
export type Event = typeof events.$inferSelect;
export type Manuscript = typeof manuscripts.$inferSelect;
export type Chapter = typeof chapters.$inferSelect;

// ---- authentication --------------------------------------------------------

/** A person who signed in through the OIDC provider. Identity = (issuer, subject). */
export const users = sqliteTable(
	'users',
	{
		id: id(),
		issuer: text('issuer').notNull(),
		subject: text('subject').notNull(),
		email: text('email').notNull().default(''),
		name: text('name').notNull().default(''),
		picture: text('picture').notNull().default(''),
		createdAt: now(),
		lastLoginAt: integer('last_login_at', { mode: 'timestamp_ms' })
			.notNull()
			.default(sql`(unixepoch('subsec') * 1000)`)
	},
	(t) => [uniqueIndex('users_issuer_subject').on(t.issuer, t.subject)]
);

/** Server-side session. The cookie carries a random token; only its SHA-256 hash is stored. */
export const sessions = sqliteTable(
	'sessions',
	{
		id: text('id').primaryKey(), // sha256(token), base64url
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		idToken: text('id_token').notNull().default(''), // for RP-initiated logout hint
		expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
		createdAt: now()
	},
	(t) => [index('sessions_user').on(t.userId), index('sessions_expires').on(t.expiresAt)]
);

// ---- ownership & sharing ---------------------------------------------------

export const WORLD_ROLES = ['owner', 'editor', 'viewer'] as const;
export type WorldRole = (typeof WORLD_ROLES)[number];

/**
 * Who can access a world and how. A row with userId = null is a pending share by email,
 * claimed automatically when a user with that email signs in.
 */
export const worldMembers = sqliteTable(
	'world_members',
	{
		id: id(),
		worldId: text('world_id')
			.notNull()
			.references(() => worlds.id, { onDelete: 'cascade' }),
		userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }),
		email: text('email').notNull(), // lowercased; the identity the share was addressed to
		role: text('role').notNull().$type<WorldRole>(),
		createdAt: now()
	},
	(t) => [
		uniqueIndex('world_members_world_email').on(t.worldId, t.email),
		index('world_members_user').on(t.userId)
	]
);

/** Shareable invite links. Accepting one adds the signed-in user as a member with `role`. */
export const worldInvites = sqliteTable(
	'world_invites',
	{
		id: id(), // doubles as the unguessable token (UUID v4)
		worldId: text('world_id')
			.notNull()
			.references(() => worlds.id, { onDelete: 'cascade' }),
		role: text('role').notNull().$type<WorldRole>(),
		createdBy: text('created_by').references(() => users.id, { onDelete: 'set null' }),
		expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
		uses: integer('uses').notNull().default(0),
		createdAt: now()
	},
	(t) => [index('world_invites_world').on(t.worldId)]
);

// ---- uploaded files --------------------------------------------------------

/** An image stored under UPLOADS_DIR, served at /w/<slug>/files/<id>. */
export const uploads = sqliteTable(
	'uploads',
	{
		id: id(),
		worldId: text('world_id')
			.notNull()
			.references(() => worlds.id, { onDelete: 'cascade' }),
		filename: text('filename').notNull(),
		mime: text('mime').notNull(),
		size: integer('size').notNull(),
		/** Path relative to UPLOADS_DIR, e.g. `<worldId>/<id>.png`. */
		storagePath: text('storage_path').notNull(),
		createdBy: text('created_by').references(() => users.id, { onDelete: 'set null' }),
		createdAt: now()
	},
	(t) => [index('uploads_world').on(t.worldId)]
);

export type Upload = typeof uploads.$inferSelect;

// ---- map pins (derived) ---------------------------------------------------

/** Pins inside map panels that link to an element; recomputed on element save. */
export const mapPins = sqliteTable(
	'map_pins',
	{
		id: id(),
		worldId: text('world_id')
			.notNull()
			.references(() => worlds.id, { onDelete: 'cascade' }),
		mapElementId: text('map_element_id')
			.notNull()
			.references(() => elements.id, { onDelete: 'cascade' }),
		panelId: text('panel_id').notNull(),
		pinId: text('pin_id').notNull(),
		elementId: text('element_id')
			.notNull()
			.references(() => elements.id, { onDelete: 'cascade' }),
		label: text('label').notNull().default('')
	},
	(t) => [index('map_pins_element').on(t.elementId), index('map_pins_map').on(t.mapElementId)]
);

// ---- revision history -----------------------------------------------------

/**
 * Content as it was *before* a save, for chapters and elements. `docId` is polymorphic and
 * has no foreign key (like `links.sourceId`), so the delete paths clean these up by hand.
 * `content` is a JSON string rather than a json column: its shape varies by kind, the list
 * query reads only `length(content)`, and the upload GC matches it with `like`.
 */
export const revisions = sqliteTable(
	'revisions',
	{
		id: id(),
		worldId: text('world_id')
			.notNull()
			.references(() => worlds.id, { onDelete: 'cascade' }),
		/** 'chapter' | 'element' */
		kind: text('kind').notNull(),
		docId: text('doc_id').notNull(),
		/** Chapter title or element name as it was then. */
		title: text('title').notNull().default(''),
		content: text('content').notNull(),
		/** Non-empty means the user pinned this version; pinned rows are never pruned. */
		label: text('label').notNull().default(''),
		authorId: text('author_id').references(() => users.id, { onDelete: 'set null' }),
		createdAt: now()
	},
	(t) => [index('revisions_doc').on(t.docId, t.createdAt), index('revisions_world').on(t.worldId)]
);

export type Revision = typeof revisions.$inferSelect;
