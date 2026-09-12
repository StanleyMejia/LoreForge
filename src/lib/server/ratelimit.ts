/**
 * A fixed-window request counter, kept in memory.
 *
 * The store is passed in rather than owned here so this stays pure and testable, and so the
 * caller decides what a bucket is keyed by.
 *
 * ponytail: fixed windows allow a double burst across a boundary (the tail of one window plus the
 * head of the next). For slowing down sign-in abuse that is immaterial; a sliding window or a
 * token bucket is the upgrade if a real limit is ever needed.
 * ponytail: in-process, so it counts per Node process. This app is a single process by design;
 * more than one replica would need a shared store.
 */
export interface Window {
	count: number;
	resetAt: number;
}

export interface Verdict {
	ok: boolean;
	/** Whole seconds until the window resets — the value for a Retry-After header. */
	retryAfter: number;
}

export function hit(
	store: Map<string, Window>,
	key: string,
	limit: number,
	windowMs: number,
	now = Date.now()
): Verdict {
	const w = store.get(key);
	if (!w || now >= w.resetAt) {
		store.set(key, { count: 1, resetAt: now + windowMs });
		return { ok: true, retryAfter: 0 };
	}
	w.count++;
	return {
		ok: w.count <= limit,
		retryAfter: Math.max(1, Math.ceil((w.resetAt - now) / 1000))
	};
}

/** Drop expired windows. Called when the store grows, so it cannot leak on a long uptime. */
export function sweep(store: Map<string, Window>, now = Date.now()): void {
	for (const [key, w] of store) if (now >= w.resetAt) store.delete(key);
}
