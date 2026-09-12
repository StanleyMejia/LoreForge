<script lang="ts">
	let { data } = $props();
	const base = $derived(`/w/${data.world.slug}`);
	let filter = $state('');

	const shown = $derived(
		filter.trim()
			? data.tags.filter((t) => t.tag.toLowerCase().includes(filter.trim().toLowerCase()))
			: data.tags
	);
	const most = $derived(data.tags[0]?.count ?? 1);
	/** Size the chips by use, so the tags a world actually leans on stand out. */
	function weight(count: number) {
		const step = Math.round((count / most) * 3);
		return ['text-xs', 'text-sm', 'text-base', 'text-lg'][step] ?? 'text-sm';
	}
</script>

<svelte:head><title>Tags · {data.world.name}</title></svelte:head>

<header class="mb-6">
	<h1 class="text-2xl font-bold text-slate-50"><span class="mr-2">🏷️</span>Tags</h1>
	<p class="muted">
		{data.tags.length}
		{data.tags.length === 1 ? 'tag' : 'tags'} across this world's elements
	</p>
</header>

{#if data.tags.length > 8}
	<input
		class="input mb-6 sm:max-w-sm"
		type="search"
		placeholder="Filter tags…"
		bind:value={filter}
	/>
{/if}

{#if shown.length}
	<div class="card flex flex-wrap items-baseline gap-2" data-role="tag-cloud">
		{#each shown as t (t.tag)}
			<a
				href="{base}/search?tag={encodeURIComponent(t.tag)}"
				class="chip hover:border-amber-600 {weight(t.count)}"
			>
				{t.tag}<span class="ml-1.5 text-xs text-slate-500">{t.count}</span>
			</a>
		{/each}
	</div>
{:else}
	<div class="card">
		<p class="muted">
			{#if data.tags.length}
				No tags match that filter.
			{:else}
				No tags yet. Add comma-separated tags when you edit an element.
			{/if}
		</p>
	</div>
{/if}
