<script lang="ts">
	import { buildTree, MAX_DEPTH, type TreeNode } from '$lib/tree';

	interface Item {
		id: string;
		slug: string;
		name: string;
		summary: string;
		typeIcon: string;
		parentId?: string | null;
		sortOrder?: number;
	}
	let {
		items,
		base,
		matched,
		openComments = {}
	}: {
		items: Item[];
		base: string;
		/** When filtering: the ids that actually matched. Others are context and stay muted. */
		matched?: Set<string>;
		/** Unresolved comment threads per element id. */
		openComments?: Record<string, number>;
	} = $props();
	const dim = $derived((id: string) => !!matched?.size && !matched.has(id));

	// A parent outside `items` (another type, or filtered out) leaves its child at the top level.
	// Siblings follow their manual order; untouched ones share 0 and keep the incoming (name) order.
	const roots = $derived(
		buildTree([...items].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)))
	);
</script>

{#snippet label(item: Item)}
	<a href="{base}/e/{item.slug}" class="group inline-flex items-baseline gap-2 py-1">
		<span class="opacity-70">{item.typeIcon}</span>
		<span class="group-hover:text-amber-300 {dim(item.id) ? 'text-slate-500' : 'text-slate-200'}"
			>{item.name}</span
		>
		{#if openComments[item.id]}
			<span
				class="chip"
				title="{openComments[item.id]} open comment thread{openComments[item.id] === 1 ? '' : 's'}"
				data-role="open-comments">💬 {openComments[item.id]}</span
			>
		{/if}
		{#if item.summary}
			<span class="muted hidden truncate text-xs sm:inline">{item.summary}</span>
		{/if}
	</a>
{/snippet}

{#snippet branch(node: TreeNode<Item>, depth: number)}
	{#if node.children.length && depth < MAX_DEPTH}
		<details open>
			<summary class="cursor-pointer marker:text-slate-600">{@render label(node.item)}</summary>
			<ul class="ml-4 border-l border-slate-800 pl-3">
				{#each node.children as child (child.item.id)}
					<li>{@render branch(child, depth + 1)}</li>
				{/each}
			</ul>
		</details>
	{:else}
		{@render label(node.item)}
	{/if}
{/snippet}

<ul data-role="element-tree">
	{#each roots as root (root.item.id)}
		<li>{@render branch(root, 0)}</li>
	{/each}
</ul>
