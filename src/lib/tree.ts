export const MAX_DEPTH = 32;

export interface TreeNode<T> {
	item: T;
	children: TreeNode<T>[];
}

/**
 * The parent chain of `id`, nearest first. Stops at a missing parent, at MAX_DEPTH, and on
 * revisiting an id, so a cycle terminates instead of hanging.
 */
export function ancestors(
	id: string,
	parentOf: (id: string) => string | null | undefined,
	max = MAX_DEPTH
): string[] {
	const chain: string[] = [];
	const seen = new Set([id]);
	let at = parentOf(id);
	while (at && !seen.has(at) && chain.length < max) {
		chain.push(at);
		seen.add(at);
		at = parentOf(at);
	}
	return chain;
}

/**
 * Roots-first forest. An item whose parent is absent from `items` becomes a root, which is
 * what makes a filtered list (one element type, say) render correctly on its own. Items in a
 * cycle reach no root and so are simply left out — the read path needs no cycle check of its own.
 */
export function buildTree<T extends { id: string; parentId?: string | null }>(
	items: T[]
): TreeNode<T>[] {
	const nodes = new Map<string, TreeNode<T>>(
		items.map((item) => [item.id, { item, children: [] }])
	);
	const roots: TreeNode<T>[] = [];
	for (const item of items) {
		const node = nodes.get(item.id)!;
		const parent = item.parentId ? nodes.get(item.parentId) : undefined;
		if (parent && parent !== node) parent.children.push(node);
		else roots.push(node);
	}
	return roots;
}
