/** A comment as pages receive it. A reply carries the id of its thread's first comment. */
export interface CommentView {
	id: string;
	parentId: string | null;
	panelId: string;
	body: string;
	createdAt: Date;
	resolvedAt: Date | null;
	author: string | null;
	authorId: string | null;
}

/**
 * The one deliberate exception to "viewers cannot write": a viewer of a shared world may post a
 * comment or reply, and delete their own, on an element page or a manuscript's read-through.
 * `rest` is the path inside the world (`/e/lucas`), `search` the request's query string. Exactly
 * one form action must be named, so a second action cannot ride along on an allowed one.
 */
export function viewerMayPost(rest: string, search: string): boolean {
	if (!/^\/e\/[^/]+$/.test(rest) && !/^\/m\/[^/]+\/read$/.test(rest)) return false;
	const keys = [...new URLSearchParams(search).keys()];
	return keys.length === 1 && (keys[0] === '/comment' || keys[0] === '/deleteComment');
}

export interface Thread<T> {
	root: T;
	replies: T[];
}

/**
 * Group an oldest-first list of comments into threads, keeping that order. A reply whose first
 * comment is not in the list stands as a thread of its own rather than disappearing.
 */
export function threads<T extends { id: string; parentId: string | null }>(
	comments: T[]
): Thread<T>[] {
	const byId = new Map<string, Thread<T>>();
	const out: Thread<T>[] = [];
	for (const c of comments) {
		if (c.parentId) continue;
		const t = { root: c, replies: [] };
		byId.set(c.id, t);
		out.push(t);
	}
	for (const c of comments) {
		if (!c.parentId) continue;
		const t = byId.get(c.parentId);
		if (t) t.replies.push(c);
		else out.push({ root: c, replies: [] });
	}
	return out;
}
