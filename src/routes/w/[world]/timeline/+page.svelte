<script lang="ts">
	import { enhance } from '$app/forms';
	import MarkdownEditor from '$lib/components/MarkdownEditor.svelte';

	let { data, form } = $props();
	const base = $derived(`/w/${data.world.slug}`);
	let showNew = $state(false);
	let newBody = $state('');
	// svelte-ignore state_referenced_locally
	let editBody = $state(data.editing?.body ?? '');
	$effect(() => {
		editBody = data.editing?.body ?? '';
	});

	const groups = $derived.by(() => {
		const out: { era: string; events: typeof data.events }[] = [];
		for (const e of data.events) {
			const last = out[out.length - 1];
			if (last && last.era === e.era) last.events.push(e);
			else out.push({ era: e.era, events: [e] });
		}
		return out;
	});
</script>

<svelte:head><title>Timeline · {data.world.name}</title></svelte:head>

<header class="mb-6 flex flex-wrap items-end justify-between gap-4">
	<div>
		<h1 class="text-2xl font-bold text-slate-50">🕰️ Timeline</h1>
		<p class="muted">
			{data.events.length} events, ordered by sort key. Use any calendar you like for the date label.
		</p>
	</div>
	<button class="btn btn-primary" onclick={() => (showNew = !showNew)}
		>{showNew ? 'Close' : '+ New event'}</button
	>
</header>

{#snippet eventFields(
	ev: { title: string; dateLabel: string; sortKey: number; era: string } | null
)}
	<div class="grid gap-3 sm:grid-cols-[2fr_1fr_1fr_1fr]">
		<div>
			<label class="label" for="title">Title</label><input
				class="input"
				id="title"
				name="title"
				required
				value={ev?.title ?? ''}
			/>
		</div>
		<div>
			<label class="label" for="dateLabel">Date label</label><input
				class="input"
				id="dateLabel"
				name="dateLabel"
				placeholder="12 Frostfall 1042"
				value={ev?.dateLabel ?? ''}
			/>
		</div>
		<div>
			<label class="label" for="sortKey">Sort key</label><input
				class="input"
				id="sortKey"
				name="sortKey"
				type="number"
				step="any"
				placeholder="e.g. year"
				value={ev?.sortKey ?? ''}
			/>
		</div>
		<div>
			<label class="label" for="era">Era</label><input
				class="input"
				id="era"
				name="era"
				placeholder="Age of Kings"
				value={ev?.era ?? ''}
			/>
		</div>
	</div>
{/snippet}

{#if showNew}
	<form method="POST" action="?/create" use:enhance class="card mb-8 space-y-4">
		<h2 class="font-semibold">New event</h2>
		{@render eventFields(null)}
		<MarkdownEditor
			name="body"
			bind:value={newBody}
			index={data.index}
			elementBase="{base}/e/"
			rows={6}
			showCount={false}
		/>
		{#if form?.error}<p class="text-sm text-red-400">{form.error}</p>{/if}
		<button class="btn btn-primary" type="submit">Add event</button>
	</form>
{/if}

{#if data.editing}
	<form method="POST" action="?/update" use:enhance class="card mb-8 space-y-4 border-amber-700/50">
		<h2 class="font-semibold">Editing: {data.editing.title}</h2>
		<input type="hidden" name="id" value={data.editing.id} />
		{@render eventFields(data.editing)}
		<MarkdownEditor
			name="body"
			bind:value={editBody}
			index={data.index}
			elementBase="{base}/e/"
			rows={8}
			showCount={false}
		/>
		{#if form?.error}<p class="text-sm text-red-400">{form.error}</p>{/if}
		<div class="flex gap-2">
			<button class="btn btn-primary" type="submit">Save</button>
			<a class="btn btn-ghost" href="{base}/timeline">Cancel</a>
		</div>
	</form>
{/if}

{#if data.events.length === 0}
	<div class="card">
		<p class="muted">No events yet. Add the founding of your world, a war, a birth, a betrayal…</p>
	</div>
{:else}
	<div class="relative ml-3 border-l border-slate-800 pl-6">
		{#each groups as g (g.era + g.events[0].id)}
			{#if g.era}
				<div class="relative mt-8 mb-3 first:mt-0">
					<span class="absolute top-1 -left-[31px] h-2.5 w-2.5 rounded-full bg-amber-500"></span>
					<h2 class="text-sm font-semibold tracking-wide text-amber-400 uppercase">{g.era}</h2>
				</div>
			{/if}
			{#each g.events as ev (ev.id)}
				<article id={ev.id} class="relative mb-4 scroll-mt-20">
					<span class="absolute top-4 -left-[29px] h-1.5 w-1.5 rounded-full bg-slate-500"></span>
					<div class="card">
						<div class="flex flex-wrap items-start justify-between gap-2">
							<div>
								<div class="text-xs text-slate-500">{ev.dateLabel || `#${ev.sortKey}`}</div>
								<h3 class="text-lg font-semibold text-slate-50">{ev.title}</h3>
							</div>
							<div class="flex gap-1">
								<a class="btn btn-ghost btn-sm" href="{base}/timeline?edit={ev.id}">Edit</a>
								<form
									method="POST"
									action="?/delete"
									use:enhance
									onsubmit={(e) => {
										if (!confirm(`Delete "${ev.title}"?`)) e.preventDefault();
									}}
								>
									<input type="hidden" name="id" value={ev.id} />
									<button class="btn btn-ghost btn-sm text-red-300" type="submit">Delete</button>
								</form>
							</div>
						</div>
						{#if ev.body.trim()}<div class="md mt-2 text-sm">{@html ev.html}</div>{/if}
						{#if ev.chapters.length}
							<div class="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
								<span>Told in:</span>
								{#each ev.chapters as c (c.chapterId)}
									<a
										class="chip hover:border-amber-600"
										href="{base}/m/{c.manuscriptId}/c/{c.chapterId}"
										>📖 {c.chapterTitle}
										<span class="ml-1 text-slate-500">{c.manuscriptTitle}</span></a
									>
								{/each}
							</div>
						{/if}
					</div>
				</article>
			{/each}
		{/each}
	</div>
{/if}
