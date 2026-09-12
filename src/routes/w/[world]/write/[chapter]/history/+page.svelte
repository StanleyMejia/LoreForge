<script lang="ts">
	import { timeAgo } from '$lib/format';
	import RevisionList from '$lib/components/RevisionList.svelte';

	let { data } = $props();
	const base = $derived(`/w/${data.world.slug}`);
</script>

<svelte:head><title>History · {data.chapter.title} · {data.world.name}</title></svelte:head>

<nav class="mb-4 text-xs text-slate-500">
	<a href="{base}/write/{data.chapter.id}" class="hover:text-amber-300">{data.chapter.title}</a>
	<span class="mx-1">/</span>History
</nav>

<h1 class="mb-1 text-2xl font-bold text-slate-50">History</h1>
<p class="muted mb-6 text-sm">
	A version is kept for each ten minutes of editing, plus any you chose to keep.
</p>

{#if data.revisions.length === 0}
	<p class="card muted">
		No earlier versions yet. One is recorded the first time you change this chapter.
	</p>
{:else}
	<RevisionList
		revisions={data.revisions}
		shownId={data.shown?.id}
		readonly={data.readonly}
		compare
	/>
{/if}

{#if data.shown}
	{@const shown = data.shown}
	{@const prev = data.revisions.find((r) => r.id === shown.id)?.prevId}
	<section class="card mt-8" data-role={data.diff ? 'revision-diff' : 'revision-detail'}>
		<header class="mb-4 flex flex-wrap items-baseline justify-between gap-2">
			<h2 class="font-serif text-lg font-semibold text-slate-50">{shown.title}</h2>
			<span class="muted text-xs">
				{#if data.diff}
					{timeAgo(shown.createdAt)} → {data.diff.current ? 'now' : timeAgo(data.diff.at)}
				{:else}
					as it was {timeAgo(shown.createdAt)}
				{/if}
			</span>
		</header>

		{#if data.diff}
			<div class="md md-serif" data-role="diff-body">
				{#each data.diff.blocks as b, i (i)}
					{#if b.type === 'same'}
						<p>{b.text}</p>
					{:else if b.type === 'add'}
						<p><ins>{b.text}</ins></p>
					{:else if b.type === 'del'}
						<p><del>{b.text}</del></p>
					{:else}
						<p>
							{#each b.words as w, k (k)}{#if w.type === 'same'}{w.text}{:else if w.type === 'add'}<ins
										>{w.text}</ins
									>{:else}<del>{w.text}</del>{/if}{/each}
						</p>
					{/if}
				{:else}
					<p class="muted">Nothing changed between these two.</p>
				{/each}
			</div>
		{:else}
			{#if shown.synopsis}
				<p class="muted mb-4 text-sm italic">{shown.synopsis}</p>
			{/if}
			{#if shown.body.trim()}
				<div class="md md-serif">{@html shown.html}</div>
			{:else}
				<p class="muted">This version was empty.</p>
			{/if}
		{/if}

		<footer class="mt-6 flex flex-wrap gap-4 border-t border-slate-800 pt-4 text-xs">
			{#if data.diff}
				<a href="?rev={shown.id}" class="muted hover:text-amber-300">Read this version</a>
			{:else}
				<a href="?rev={shown.id}&vs=current" class="muted hover:text-amber-300">Compare with now</a>
			{/if}
			{#if prev}
				<a href="?rev={prev}&vs={shown.id}" class="muted hover:text-amber-300"
					>Compare with the version before it</a
				>
			{/if}
			<a href="?" class="muted ml-auto hover:text-amber-300">Close</a>
		</footer>
	</section>
{/if}
