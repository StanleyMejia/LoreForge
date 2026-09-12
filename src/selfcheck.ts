/** Self-check for the shared slug/coercion helpers. Run: node src/selfcheck.ts */
import assert from 'node:assert/strict';
import { slugify, uniquify } from './lib/slug.ts';
import { num, str } from './lib/server/coerce.ts';

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

console.log('selfcheck ok');
