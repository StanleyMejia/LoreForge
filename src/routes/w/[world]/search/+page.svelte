<script lang="ts">
	import ElementCard from '$lib/components/ElementCard.svelte';
	import { snippetHtml } from '$lib/snippet';

	let { data } = $props();
	const base = $derived(`/w/${data.world.slug}`);
	const labels = { element: 'Elements', chapter: 'Chapters', event: 'Timeline events' } as const;
	const groups = $derived(
		(['element', 'chapter', 'event'] as const)
			.map((kind) => ({
				kind,
				label: labels[kind],
				hits: data.hits.filter((h) => h.kind === kind)
			}))
			.filter((g) => g.hits.length)
	);
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
		placeholder="Names, notes, chapters, events…"
	/>
	<button class="btn" type="submit">Search</button>
</form>

{#if data.tag}
	<p class="muted mb-4">{data.tagged.length} element{data.tagged.length === 1 ? '' : 's'}</p>
	<div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
		{#each data.tagged as el (el.id)}<ElementCard {base} {el} showType />{/each}
	</div>
{:else if data.q}
	<p class="muted mb-4">
		{data.hits.length} result{data.hits.length === 1 ? '' : 's'} for
		<span class="text-slate-200">“{data.q}”</span>
	</p>
	{#each groups as g (g.kind)}
		<section class="mb-8" data-role="search-{g.kind}">
			<h2 class="mb-2 text-sm font-semibold tracking-wide text-slate-400 uppercase">
				{g.label} · {g.hits.length}
			</h2>
			<ul class="space-y-2">
				{#each g.hits as h (h.id)}
					<li>
						<a href={h.href} class="card block hover:border-slate-600">
							<div class="flex items-baseline gap-2">
								<span>{h.icon}</span>
								<span class="font-semibold text-slate-50">{h.title}</span>
								<span class="text-xs text-slate-500">{h.subtitle}</span>
							</div>
							{#if h.snippet.trim()}<p class="snippet muted mt-1 text-sm">
									{@html snippetHtml(h.snippet)}
								</p>{/if}
						</a>
					</li>
				{/each}
			</ul>
		</section>
	{:else}
		<div class="card">
			<p class="muted">
				Nothing matched. Try fewer or shorter words; prefixes match (e.g. <code>Yso</code>).
			</p>
		</div>
	{/each}
{/if}
