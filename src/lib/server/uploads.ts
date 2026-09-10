import { env } from '$env/dynamic/private';
import { copyFileSync, createReadStream, existsSync, mkdirSync, rmSync, statSync } from 'node:fs';
import { writeFile, unlink } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';
import { Readable } from 'node:stream';

/** Root directory for uploaded files. Inside the /data volume in Docker. */
export const UPLOADS_DIR = resolve(
	env.UPLOADS_DIR || join(dirname(env.DATABASE_URL || 'data/loreforge.db'), 'uploads')
);
export const MAX_UPLOAD_BYTES = Math.max(1, Number(env.MAX_UPLOAD_MB) || 10) * 1024 * 1024;

const SIGNATURES: { mime: string; ext: string; test: (b: Uint8Array) => boolean }[] = [
	{
		mime: 'image/png',
		ext: 'png',
		test: (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47
	},
	{ mime: 'image/jpeg', ext: 'jpg', test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
	{
		mime: 'image/gif',
		ext: 'gif',
		test: (b) => b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38
	},
	{
		mime: 'image/webp',
		ext: 'webp',
		test: (b) =>
			b[0] === 0x52 &&
			b[1] === 0x49 &&
			b[2] === 0x46 &&
			b[3] === 0x46 &&
			b[8] === 0x57 &&
			b[9] === 0x45 &&
			b[10] === 0x42 &&
			b[11] === 0x50
	}
];

/** Detect the image type from magic bytes. The client-supplied content type is not trusted. */
export function sniffImage(bytes: Uint8Array): { mime: string; ext: string } | null {
	if (bytes.length < 12) return null;
	const hit = SIGNATURES.find((s) => s.test(bytes));
	return hit ? { mime: hit.mime, ext: hit.ext } : null;
}

/** Absolute path for a stored file; refuses anything that escapes UPLOADS_DIR. */
export function absolutePath(storagePath: string): string {
	const abs = resolve(UPLOADS_DIR, storagePath);
	if (abs !== UPLOADS_DIR && !abs.startsWith(UPLOADS_DIR + sep))
		throw new Error('invalid storage path');
	return abs;
}

export async function storeFile(
	worldId: string,
	id: string,
	ext: string,
	data: Uint8Array
): Promise<string> {
	const rel = `${worldId}/${id}.${ext}`;
	const abs = absolutePath(rel);
	mkdirSync(dirname(abs), { recursive: true });
	await writeFile(abs, data);
	return rel;
}

export function fileExists(storagePath: string): boolean {
	try {
		return statSync(absolutePath(storagePath)).isFile();
	} catch {
		return false;
	}
}

/** A web ReadableStream for a stored file (for Response bodies). */
export function openFile(storagePath: string): ReadableStream {
	return Readable.toWeb(createReadStream(absolutePath(storagePath))) as ReadableStream;
}

export async function removeFile(storagePath: string) {
	try {
		await unlink(absolutePath(storagePath));
	} catch {
		/* already gone */
	}
}

export function removeWorldDir(worldId: string) {
	const dir = absolutePath(worldId);
	if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
}

/**
 * Copy a stored file into another world (used by import). Returns the new relative path,
 * or null when the source file is missing (e.g. the uploads directory was not copied along).
 */
export function copyStored(sourcePath: string, worldId: string, id: string): string | null {
	if (!fileExists(sourcePath)) return null;
	const ext = sourcePath.includes('.') ? sourcePath.slice(sourcePath.lastIndexOf('.') + 1) : 'bin';
	const rel = `${worldId}/${id}.${ext}`;
	const abs = absolutePath(rel);
	mkdirSync(dirname(abs), { recursive: true });
	copyFileSync(absolutePath(sourcePath), abs);
	return rel;
}
