<script lang="ts">
	import { buildTree, MAX_DEPTH, type TreeNode } from '$lib/tree';

	interface Item {
		id: string;
		slug: string;
		name: string;
		summary: string;
		typeIcon: string;
		parentId?: string | null;
	}
	let { items, base }: { items: Item[]; base: string } = $props();

	// A parent outside `items` (another type, or filtered out) leaves its child at the top level.
	const roots = $derived(buildTree(items));
</script>

{#snippet label(item: Item)}
	<a href="{base}/e/{item.slug}" class="group inline-flex items-baseline gap-2 py-1">
		<span class="opacity-70">{item.typeIcon}</span>
		<span class="text-slate-200 group-hover:text-amber-300">{item.name}</span>
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
