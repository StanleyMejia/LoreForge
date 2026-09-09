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
	<p class="muted mb-4">{data.results.length} result{data.results.length === 1 ? '' : 's'}</p>
	{#if data.results.length}
		<div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
			{#each data.results as el (el.id)}<ElementCard {base} {el} showType />{/each}
		</div>
	{/if}
{/if}
