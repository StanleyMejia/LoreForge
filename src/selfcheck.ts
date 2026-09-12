/** Self-check for the pure shared helpers. Run: node src/selfcheck.ts */
import assert from 'node:assert/strict';
import { slugify, uniquify } from './lib/slug.ts';
import { num, str } from './lib/server/coerce.ts';
import { MAX_REVISIONS, prunable, REVISION_WINDOW_MS, revisionDue } from './lib/revisions.ts';

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

console.log('selfcheck ok');
