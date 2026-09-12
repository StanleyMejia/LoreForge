<script lang="ts">
	import { timeAgo } from '$lib/format';
	import ElementPanels from '$lib/components/ElementPanels.svelte';
	import RevisionList from '$lib/components/RevisionList.svelte';

	let { data } = $props();
	const base = $derived(`/w/${data.world.slug}`);
</script>

<svelte:head><title>History · {data.element.name} · {data.world.name}</title></svelte:head>

<nav class="mb-4 text-xs text-slate-500">
	<a href="{base}/e/{data.element.slug}" class="hover:text-amber-300">{data.element.name}</a>
	<span class="mx-1">/</span>History
</nav>

<h1 class="mb-1 text-2xl font-bold text-slate-50">History</h1>
<p class="muted mb-6 text-sm">
	A version is kept for each ten minutes of editing, plus any you chose to keep.
</p>

{#if data.revisions.length === 0}
	<p class="card muted">
		No earlier versions yet. One is recorded the first time you change this element.
	</p>
{:else}
	<RevisionList revisions={data.revisions} shownId={data.shown?.id} readonly={data.readonly} />
{/if}

{#if data.shown}
	<section class="mt-8" data-role="revision-detail">
		<header class="mb-4 flex flex-wrap items-baseline justify-between gap-2">
			<h2 class="font-serif text-xl font-semibold text-slate-50">{data.shown.title}</h2>
			<span class="muted text-xs">as it was {timeAgo(data.shown.createdAt)}</span>
		</header>
		{#if data.shown.summary}<p class="muted mb-4">{data.shown.summary}</p>{/if}
		<div class="space-y-4">
			<ElementPanels panels={data.shown.panels} {base}>
				{#snippet empty()}
					<p class="muted">This version had nothing filled in.</p>
				{/snippet}
			</ElementPanels>
		</div>
		<p class="mt-6 border-t border-slate-800 pt-4 text-xs">
			<a href="?" class="muted hover:text-amber-300">Close</a>
		</p>
	</section>
{/if}
