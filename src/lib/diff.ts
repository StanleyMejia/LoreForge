/**
 * A two-level text diff, shaped for prose rather than code.
 *
 * A plain line diff is useless on markdown: a paragraph is one long line, so any edit inside it
 * reports the whole paragraph as changed — exactly where a writer wants detail. So paragraphs are
 * matched first, and a paragraph that was only edited is then diffed word by word.
 */

export interface Chunk {
	type: 'same' | 'add' | 'del';
	text: string;
}

export type Block =
	| { type: 'same'; text: string }
	| { type: 'add'; text: string }
	| { type: 'del'; text: string }
	| { type: 'edit'; words: Chunk[] };

/** Paragraph pairs at least this similar are treated as an edit rather than a delete plus an add. */
const SIMILAR = 0.4;
// ponytail: the LCS table is O(n·m), so both levels are capped and fall back to whole-block
// add/delete beyond it. Prose never comes close; a pasted 2 MB blob would.
const MAX_CELLS = 4_000_000;

/** Longest common subsequence of two token arrays, as the aligned operations to get from a to b. */
function align<T>(a: T[], b: T[], same: (x: T, y: T) => boolean): ('same' | 'add' | 'del')[] {
	if (a.length * b.length > MAX_CELLS) {
		return [...a.map(() => 'del' as const), ...b.map(() => 'add' as const)];
	}
	// lcs[i][j] = length of the longest common subsequence of a[i..] and b[j..]
	const lcs: number[][] = Array.from({ length: a.length + 1 }, () =>
		new Array(b.length + 1).fill(0)
	);
	for (let i = a.length - 1; i >= 0; i--)
		for (let j = b.length - 1; j >= 0; j--)
			lcs[i][j] = same(a[i], b[j]) ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);

	const ops: ('same' | 'add' | 'del')[] = [];
	let i = 0;
	let j = 0;
	while (i < a.length && j < b.length) {
		if (same(a[i], b[j])) {
			ops.push('same');
			i++;
			j++;
		} else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
			ops.push('del');
			i++;
		} else {
			ops.push('add');
			j++;
		}
	}
	while (i++ < a.length) ops.push('del');
	while (j++ < b.length) ops.push('add');
	return ops;
}

/** Split on whitespace, keeping it, so rebuilt text spaces correctly. */
function words(s: string): string[] {
	return s.match(/\s+|[^\s]+/g) ?? [];
}

/** Word-level diff of two paragraphs, with runs of the same kind merged. */
export function diffWords(a: string, b: string): Chunk[] {
	const x = words(a);
	const y = words(b);
	const out: Chunk[] = [];
	let i = 0;
	let j = 0;
	for (const op of align(x, y, (p, q) => p === q)) {
		const text = op === 'add' ? y[j++] : op === 'del' ? x[i++] : (i++, j++, x[i - 1]);
		const last = out[out.length - 1];
		if (last && last.type === op) last.text += text;
		else out.push({ type: op, text });
	}
	return out;
}

/** How much of two paragraphs is shared, 0..1, by word count. */
function similarity(a: string, b: string): number {
	const chunks = diffWords(a, b);
	let same = 0;
	let total = 0;
	for (const c of chunks) {
		const n = c.text.trim() ? c.text.trim().split(/\s+/).length : 0;
		total += n;
		if (c.type === 'same') same += n;
	}
	return total === 0 ? 1 : same / total;
}

/** Blank-line separated paragraphs, blanks dropped. */
function paragraphs(s: string): string[] {
	return s
		.split(/\n\s*\n/)
		.map((p) => p.trim())
		.filter(Boolean);
}

/**
 * Paragraph-level diff of two documents. A deleted paragraph immediately followed by an added one
 * that is recognisably a rewrite of it becomes a single word-level `edit` block.
 */
export function diffBlocks(a: string, b: string): Block[] {
	const x = paragraphs(a);
	const y = paragraphs(b);
	const raw: Block[] = [];
	let i = 0;
	let j = 0;
	for (const op of align(x, y, (p, q) => p === q)) {
		if (op === 'same') raw.push({ type: 'same', text: (i++, j++, x[i - 1]) });
		else if (op === 'del') raw.push({ type: 'del', text: x[i++] });
		else raw.push({ type: 'add', text: y[j++] });
	}

	const out: Block[] = [];
	for (let k = 0; k < raw.length; k++) {
		const cur = raw[k];
		const next = raw[k + 1];
		if (
			cur.type === 'del' &&
			next &&
			next.type === 'add' &&
			similarity(cur.text, next.text) >= SIMILAR
		) {
			out.push({ type: 'edit', words: diffWords(cur.text, next.text) });
			k++;
		} else {
			out.push(cur);
		}
	}
	return out;
}
