/** Small helpers for reading SvelteKit form-action payloads. */
export function str(form: FormData, key: string, fallback = ''): string {
	const v = form.get(key);
	return typeof v === 'string' ? v : fallback;
}

export function num(form: FormData, key: string, fallback = 0): number {
	const v = Number(str(form, key));
	return Number.isFinite(v) ? v : fallback;
}

export function parseTags(raw: string): string[] {
	const seen = new Set<string>();
	for (const t of raw.split(',')) {
		const s = t.trim();
		if (s) seen.add(s);
	}
	return [...seen];
}

export function parseJson<T>(raw: string, fallback: T): T {
	try {
		return JSON.parse(raw) as T;
	} catch {
		return fallback;
	}
}
