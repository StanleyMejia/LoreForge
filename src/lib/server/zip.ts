import { crc32, deflateRawSync } from 'node:zlib';

/**
 * Just enough ZIP to build the two container formats that need one (EPUB and DOCX). Both are
 * small archives of text, so there is no streaming, no zip64 and no data descriptors.
 *
 * Timestamps are fixed to the DOS epoch, which makes the same manuscript export byte-identical
 * every time — handy for diffing an export and for caching.
 */
export interface ZipEntry {
	path: string;
	data: string | Uint8Array;
	/** EPUB requires its `mimetype` entry to be stored rather than deflated. */
	store?: boolean;
}

const DOS_EPOCH_TIME = 0;
const DOS_EPOCH_DATE = 0x0021; // 1980-01-01

function u16(n: number): Uint8Array {
	return new Uint8Array([n & 0xff, (n >>> 8) & 0xff]);
}
function u32(n: number): Uint8Array {
	return new Uint8Array([n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff]);
}

export function zip(entries: ZipEntry[]): Uint8Array<ArrayBuffer> {
	const local: Buffer[] = [];
	const central: Buffer[] = [];
	let offset = 0;

	for (const e of entries) {
		const name = Buffer.from(e.path, 'utf8');
		const raw = typeof e.data === 'string' ? Buffer.from(e.data, 'utf8') : Buffer.from(e.data);
		const sum = crc32(raw);
		const deflated = e.store ? raw : deflateRawSync(raw, { level: 9 });
		// Deflate can grow incompressible input; storing it is then both smaller and simpler.
		const stored = e.store || deflated.length >= raw.length;
		const body = stored ? raw : deflated;
		const method = stored ? 0 : 8;

		const header = Buffer.concat([
			Buffer.from('PK\x03\x04', 'latin1'),
			u16(20), // version needed
			u16(0), // flags
			u16(method),
			u16(DOS_EPOCH_TIME),
			u16(DOS_EPOCH_DATE),
			u32(sum),
			u32(body.length),
			u32(raw.length),
			u16(name.length),
			u16(0) // extra field length
		]);
		local.push(header, name, body);

		central.push(
			Buffer.concat([
				Buffer.from('PK\x01\x02', 'latin1'),
				u16(20), // version made by
				u16(20), // version needed
				u16(0),
				u16(method),
				u16(DOS_EPOCH_TIME),
				u16(DOS_EPOCH_DATE),
				u32(sum),
				u32(body.length),
				u32(raw.length),
				u16(name.length),
				u16(0), // extra
				u16(0), // comment
				u16(0), // disk number
				u16(0), // internal attrs
				u32(0), // external attrs
				u32(offset),
				name
			])
		);
		offset += header.length + name.length + body.length;
	}

	const dir = Buffer.concat(central);
	// Copied into a plain Uint8Array: Buffer's ArrayBufferLike backing does not satisfy the
	// web BodyInit type, and an archive of text is small enough that the copy is free.
	return new Uint8Array(
		Buffer.concat([
			...local,
			dir,
			Buffer.concat([
				Buffer.from('PK\x05\x06', 'latin1'),
				u16(0), // this disk
				u16(0), // disk with the directory
				u16(entries.length),
				u16(entries.length),
				u32(dir.length),
				u32(offset),
				u16(0) // comment length
			])
		])
	);
}

/** Escape text for XML content or a double-quoted attribute. */
export function xml(s: string): string {
	return s
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&apos;');
}
