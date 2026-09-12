/** Self-check for the pure shared helpers. Run: node src/selfcheck.ts */
import assert from 'node:assert/strict';
import { slugify, uniquify } from './lib/slug.ts';
import { num, str } from './lib/server/coerce.ts';
import { MAX_REVISIONS, prunable, REVISION_WINDOW_MS, revisionDue } from './lib/revisions.ts';
import { ancestors, buildTree, MAX_DEPTH } from './lib/tree.ts';
import { diffBlocks, diffWords } from './lib/diff.ts';
import { xml, zip } from './lib/server/zip.ts';

const taken = new Set(['ash', 'ash-2']);
assert.equal(
	uniquify('ash', (s) => taken.has(s)),
	'ash-3'
);
assert.equal(
	uniquify('ash', () => false),
	'ash'
);
assert.equal(
	uniquify(slugify('Ash Vale!'), (s) => s === 'ash-vale'),
	'ash-vale-2'
);

assert.equal(str('abcdef', 3), 'abc');
assert.equal(str(42, 10), '');
assert.equal(num('7'), 7);
assert.equal(num('nope', 5), 5);
assert.equal(num(undefined, 0.5), 0.5);

// --- revision window ---
assert.equal(revisionDue(undefined), true, 'no history yet: record one');
assert.equal(revisionDue(1000, 1000 + REVISION_WINDOW_MS - 1), false, 'inside the window: skip');
assert.equal(revisionDue(1000, 1000 + REVISION_WINDOW_MS), true, 'exactly at the window: record');

// --- retention ---
const row = (i: number, label = '') => ({ id: `r${i}`, label });
assert.deepEqual(prunable([]), []);
assert.deepEqual(prunable([row(1), row(2)]), [], 'under the cap: nothing to prune');
const many = Array.from({ length: MAX_REVISIONS + 10 }, (_, i) => row(i));
assert.deepEqual(
	prunable(many),
	many.slice(MAX_REVISIONS).map((r) => r.id),
	'prunes the oldest beyond the cap'
);
// Pinned rows survive even as the oldest, and never eat into the budget.
const pinnedOldest = [...many, row(999, 'kept')];
assert.equal(prunable(pinnedOldest).includes('r999'), false, 'pinned rows are never pruned');
assert.deepEqual(
	prunable(pinnedOldest),
	prunable(many),
	'pinned rows do not count against the cap'
);

// --- ancestor chains ---
const chain: Record<string, string | null> = { c: 'b', b: 'a', a: null };
assert.deepEqual(
	ancestors('c', (i) => chain[i]),
	['b', 'a'],
	'nearest ancestor first'
);
assert.deepEqual(
	ancestors('a', (i) => chain[i]),
	[],
	'a root has no ancestors'
);
assert.deepEqual(
	ancestors('c', () => undefined),
	[],
	'a missing parent stops the walk'
);
// Cycles must terminate rather than hang, however they got into the database.
const cycle: Record<string, string> = { x: 'y', y: 'x' };
assert.deepEqual(
	ancestors('x', (i) => cycle[i]),
	['y'],
	'a 2-cycle terminates without repeats'
);
assert.deepEqual(
	ancestors('s', () => 's'),
	[],
	'self-parent yields nothing'
);
const deep: Record<string, string> = {};
for (let i = 0; i < 100; i++) deep[`n${i}`] = `n${i + 1}`;
assert.equal(ancestors('n0', (i) => deep[i]).length, MAX_DEPTH, 'the walk is capped at MAX_DEPTH');

// --- tree building ---
const node = (id: string, parentId: string | null = null) => ({ id, parentId });
assert.deepEqual(buildTree([]), []);
const twoLevel = buildTree([node('a'), node('b', 'a'), node('c', 'a')]);
assert.equal(twoLevel.length, 1, 'one root');
assert.deepEqual(
	twoLevel[0].children.map((c) => c.item.id),
	['b', 'c'],
	'children keep input order'
);
// A parent outside the list (another type, say) leaves the child at the top level.
const orphan = buildTree([node('b', 'missing')]);
assert.equal(orphan.length, 1, 'an absent parent makes the child a root');
assert.deepEqual(buildTree([node('x', 'y'), node('y', 'x')]), [], 'a cycle renders nothing');
assert.equal(buildTree([node('s', 's')]).length, 1, 'a self-parent stays a root, not a loop');

// --- word diff ---
const text = (cs: { type: string; text: string }[]) => cs.map((c) => c.text).join('');
assert.deepEqual(diffWords('a b', 'a b'), [{ type: 'same', text: 'a b' }], 'identical is one run');
// Reconstructing either side from the chunks must give back the original, exactly.
for (const [a, b] of [
	['the warlord rode north', 'the warlord rode south'],
	['', 'all new text'],
	['everything removed', ''],
	['one two three four', 'one three five']
]) {
	const cs = diffWords(a, b);
	assert.equal(text(cs.filter((c) => c.type !== 'add')), a, `left rebuilds: ${a}`);
	assert.equal(text(cs.filter((c) => c.type !== 'del')), b, `right rebuilds: ${b}`);
}
// An edit inside a sentence must stay an edit, not a wholesale replacement.
const sw = diffWords('the warlord rode north', 'the warlord rode south');
assert.equal(sw.filter((c) => c.type === 'same').length > 0, true, 'shared words stay shared');
assert.deepEqual(
	sw.filter((c) => c.type !== 'same').map((c) => [c.type, c.text.trim()]),
	[
		['del', 'north'],
		['add', 'south']
	],
	'only the changed word is marked'
);

// --- block diff: the reason this is two-level and not a line diff ---
const before = 'First para, untouched.\n\nSecond para, the warlord rode north.';
const after = 'First para, untouched.\n\nSecond para, the warlord rode south.';
const blocks = diffBlocks(before, after);
assert.equal(blocks.length, 2, 'one block per paragraph');
assert.equal(blocks[0].type, 'same', 'an untouched paragraph is not reported as changed');
assert.equal(blocks[1].type, 'edit', 'an edited paragraph refines to word level');
assert.deepEqual(
	blocks[1].type === 'edit'
		? blocks[1].words.filter((c) => c.type !== 'same').map((c) => c.text.trim())
		: [],
	['north.', 'south.'],
	'and names only the words that moved (punctuation travels with its word)'
);
// A wholly different paragraph is an add plus a delete, not a nonsensical word soup.
const swapped = diffBlocks('Alpha beta gamma.', 'Nothing whatsoever alike here.');
assert.deepEqual(
	swapped.map((b) => b.type),
	['del', 'add'],
	'dissimilar paragraphs are not merged'
);
assert.deepEqual(diffBlocks('same', 'same'), [{ type: 'same', text: 'same' }]);
assert.deepEqual(diffBlocks('', ''), [], 'empty documents diff to nothing');

// --- zip container ---
// A hand-written archive format only stays correct if something checks the offsets.
const archive = zip([
	{ path: 'mimetype', data: 'application/epub+zip', store: true },
	{ path: 'big.txt', data: 'compress me '.repeat(400) },
	{ path: 'dir/small.xml', data: '<a/>' }
]);
const sig = (at: number) =>
	[...archive.slice(at, at + 4)].map((b) => b.toString(16).padStart(2, '0')).join('');
assert.equal(sig(0), '504b0304', 'starts with a local file header');
const u32at = (at: number) =>
	archive[at] | (archive[at + 1] << 8) | (archive[at + 2] << 16) | (archive[at + 3] << 24);
// End of central directory is the last 22 bytes when there is no archive comment.
const eocd = archive.length - 22;
assert.equal(sig(eocd), '504b0506', 'ends with an end-of-central-directory record');
assert.equal(archive[eocd + 8] | (archive[eocd + 9] << 8), 3, 'records every entry');
const dirAt = u32at(eocd + 16);
assert.equal(sig(dirAt), '504b0102', 'the directory offset points at the first central header');
assert.equal(u32at(eocd + 12), archive.length - 22 - dirAt, 'directory size matches its span');
// A stored entry must not be deflated: EPUB readers require it of `mimetype`.
assert.equal(archive[8] | (archive[9] << 8), 0, 'the first entry is stored, not deflated');
assert.equal(
	Buffer.from(archive.slice(30, 38)).toString(),
	'mimetype',
	'and is the entry we asked to be first'
);
assert.equal(zip([]).length, 22, 'an empty archive is just the end record');

assert.equal(xml('a & b < c > "d" \'e\''), 'a &amp; b &lt; c &gt; &quot;d&quot; &apos;e&apos;');

console.log('selfcheck ok');
