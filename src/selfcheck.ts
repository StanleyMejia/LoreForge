/** Self-check for the pure shared helpers. Run: node src/selfcheck.ts */
import assert from 'node:assert/strict';
import { slugify, uniquify } from './lib/slug.ts';
import { num, str } from './lib/server/coerce.ts';
import { MAX_REVISIONS, prunable, REVISION_WINDOW_MS, revisionDue } from './lib/revisions.ts';
import { ancestors, buildTree, MAX_DEPTH } from './lib/tree.ts';

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

console.log('selfcheck ok');
