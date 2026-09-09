<script lang="ts">
	import ElementCard from '$lib/components/ElementCard.svelte';

	let { data } = $props();
	const base = $derived(`/w/${data.world.slug}`);
</script>

<svelte:head><title>Search · {data.world.name}</title></svelte:head>

<h1 class="mb-4 text-2xl font-bold text-slate-50">
	{#if data.tag}Tagged <span class="chip text-base">{data.tag}</span>{:else}Search{/if}
</h1>

<form class="mb-6 flex max-w-xl gap-2">
	<input
		class="input"
		type="search"
		name="q"
		value={data.q}
		placeholder="Names, summaries, notes, tags…"
	/>
	<button class="btn" type="submit">Search</button>
</form>

{#if data.q || data.tag}
	<p class="muted mb-4">
		{data.results.length} element{data.results.length === 1 ? '' : 's'}{#if data.chapters.length}
			· {data.chapters.length} chapter{data.chapters.length === 1 ? '' : 's'}{/if}
	</p>
	{#if data.results.length}
		<div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
			{#each data.results as el (el.id)}<ElementCard {base} {el} showType />{/each}
		</div>
	{/if}
	{#if data.chapters.length}
		<h2 class="mt-8 mb-3 text-sm font-semibold tracking-wide text-slate-400 uppercase">Chapters</h2>
		<ul class="space-y-2">
			{#each data.chapters as c (c.id)}
				<li>
					<a href="{base}/m/{c.manuscriptId}/c/{c.id}" class="card block hover:border-slate-600">
						<div class="font-semibold">
							📖 {c.title} <span class="muted font-normal">· {c.manuscriptTitle}</span>
						</div>
						{#if c.synopsis}<div class="muted mt-0.5 text-xs">{c.synopsis}</div>{/if}
						<div class="mt-1 text-xs text-slate-500">{c.wordCount} words · {c.status}</div>
					</a>
				</li>
			{/each}
		</ul>
	{/if}
{/if}
