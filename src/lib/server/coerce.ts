/** Coerce untrusted JSON values: `max` truncates, anything else becomes the fallback. */
export const str = (v: unknown, max: number): string =>
	typeof v === 'string' ? v.slice(0, max) : '';

export function num(v: unknown, fallback = 0): number {
	const x = typeof v === 'number' ? v : Number(v);
	return Number.isFinite(x) ? x : fallback;
}
