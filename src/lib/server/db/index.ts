import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import Database from 'better-sqlite3';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as schema from './schema';
import { env } from '$env/dynamic/private';

const dbPath = env.DATABASE_URL || 'data/loreforge.db';
mkdirSync(dirname(dbPath), { recursive: true });

const client = new Database(dbPath);
client.pragma('journal_mode = WAL');
client.pragma('foreign_keys = ON');
client.pragma('busy_timeout = 5000');

export const db = drizzle(client, { schema });

/**
 * Migrations live in <repo>/drizzle. In dev that is process.cwd()/drizzle; in the
 * adapter-node build the server chunk sits several levels deep, so walk upward.
 * MIGRATIONS_DIR can override for containers.
 */
function findMigrations(): string {
	if (env.MIGRATIONS_DIR) return env.MIGRATIONS_DIR;
	const here = dirname(fileURLToPath(import.meta.url));
	const candidates = [resolve(process.cwd(), 'drizzle')];
	let dir = here;
	for (let i = 0; i < 6; i++) {
		candidates.push(resolve(dir, 'drizzle'));
		dir = dirname(dir);
	}
	for (const c of candidates) {
		if (existsSync(resolve(c, 'meta/_journal.json'))) return c;
	}
	throw new Error(`Could not locate drizzle migrations folder (tried ${candidates.join(', ')})`);
}

migrate(db, { migrationsFolder: findMigrations() });

// Populate the full-text index after an upgrade from a version without it.
import('../repo/search').then(({ indexNeedsRebuild, rebuildIndex }) => {
	if (indexNeedsRebuild()) {
		console.log('[search] building full-text index');
		rebuildIndex();
	}
});

export { schema };
