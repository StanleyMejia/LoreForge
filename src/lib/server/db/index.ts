import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import * as schema from './schema';
import { env } from '$env/dynamic/private';

const dbPath = env.DATABASE_URL || 'data/loreforge.db';
mkdirSync(dirname(dbPath), { recursive: true });

const client = new Database(dbPath);
client.pragma('journal_mode = WAL');
client.pragma('foreign_keys = ON');
client.pragma('busy_timeout = 5000');

export const db = drizzle(client, { schema });

// Migrations live in <repo>/drizzle: process.cwd()/drizzle in dev, MIGRATIONS_DIR in the container.
migrate(db, { migrationsFolder: env.MIGRATIONS_DIR || resolve(process.cwd(), 'drizzle') });

// Populate the full-text index after an upgrade from a version without it.
import('../repo/search').then(({ indexNeedsRebuild, rebuildIndex }) => {
	if (indexNeedsRebuild()) {
		console.log('[search] building full-text index');
		rebuildIndex();
	}
});

export { schema };
