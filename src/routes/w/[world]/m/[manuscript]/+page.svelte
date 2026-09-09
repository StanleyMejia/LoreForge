<script lang="ts">
	import { enhance } from '$app/forms';
	import { fmtNumber, timeAgo } from '$lib/format';
	import { ROLE_LABELS } from '$lib/types';

	let { data, form } = $props();
	const base = $derived(`/w/${data.world.slug}`);
	const mbase = $derived(`${base}/m/${data.manuscript.id}`);
	const total = $derived(data.chapters.reduce((n, c) => n + c.wordCount, 0));
	let editMeta = $state(false);
	let confirmDelete = $state(false);
	const statusColor: Record<string, string> = {
		draft: 'text-slate-400',
		revised: 'text-sky-300',
		final: 'text-emerald-300'
	};
</script>

<svelte:head><title>{data.manuscript.title} · {data.world.name}</title></svelte:head>

<nav class="mb-4 text-xs text-slate-500">
	<a href="{base}/manuscripts" class="hover:text-slate-300">📖 Manuscripts</a>
	<span class="mx-1">/</span> <span class="text-slate-300">{data.manuscript.title}</span>
</nav>

<header class="mb-6 flex flex-wrap items-start justify-between gap-4">
	<div>
		<h1 class="text-3xl font-bold text-slate-50">{data.manuscript.title}</h1>
		{#if data.manuscript.description}<p class="muted mt-1 max-w-2xl">
				{data.manuscript.description}
			</p>{/if}
		<p class="mt-2 text-xs text-slate-500">
			{data.chapters.length} chapters · {fmtNumber(total)} words
		</p>
	</div>
	<div class="flex gap-2">
		<a class="btn" href="{mbase}/read">Read through</a>
		<button class="btn" onclick={() => (editMeta = !editMeta)}>Edit details</button>
		{#if confirmDelete}
			<form method="POST" action="?/delete" use:enhance>
				<button class="btn btn-danger" type="submit">Really delete</button>
			</form>
			<button class="btn btn-ghost" onclick={() => (confirmDelete = false)}>Cancel</button>
		{:else}
			<button class="btn btn-ghost" onclick={() => (confirmDelete = true)}>Delete</button>
		{/if}
	</div>
</header>

{#if editMeta}
	<form
		method="POST"
		action="?/update"
		use:enhance={() =>
			async ({ update }) => {
				await update();
				editMeta = false;
			}}
		class="card mb-6 space-y-3"
	>
		<div>
			<label class="label" for="title">Title</label><input
				class="input"
				id="title"
				name="title"
				value={data.manuscript.title}
				required
			/>
		</div>
		<div>
			<label class="label" for="description">Description</label><textarea
				class="textarea min-h-16"
				id="description"
				name="description">{data.manuscript.description}</textarea
			>
		</div>
		{#if form?.error}<p class="text-sm text-red-400">{form.error}</p>{/if}
		<button class="btn btn-primary" type="submit">Save</button>
	</form>
{/if}

<div class="grid gap-6 lg:grid-cols-[1fr_300px]">
	<section class="card">
		<h2 class="mb-3 text-sm font-semibold tracking-wide text-slate-400 uppercase">Chapters</h2>
		{#if data.chapters.length}
			<ol class="divide-y divide-slate-800">
				{#each data.chapters as c, i (c.id)}
					<li class="flex items-center gap-3 py-2">
						<span class="w-6 text-right text-xs text-slate-600">{i + 1}</span>
						<a href="{mbase}/c/{c.id}" class="min-w-0 flex-1 hover:text-amber-300">
							<div class="truncate font-medium">{c.title}</div>
							{#if c.synopsis}<div class="muted truncate text-xs">{c.synopsis}</div>{/if}
							{#if c.pov || c.location || c.castCount}
								<div class="mt-0.5 flex flex-wrap gap-1 text-[11px] text-slate-500">
									{#if c.pov}<span title="Point of view">👁 {c.pov.name}</span>{/if}
									{#if c.location}<span title="Location">{c.location.icon} {c.location.name}</span
										>{/if}
									{#if c.castCount}<span title="Cast">👥 {c.castCount}</span>{/if}
								</div>
							{/if}
						</a>
						<span class="text-xs {statusColor[c.status] ?? ''}">{c.status}</span>
						<span class="w-20 text-right text-xs text-slate-500">{fmtNumber(c.wordCount)} w</span>
						<span class="hidden w-24 text-right text-xs text-slate-600 sm:block"
							>{timeAgo(c.updatedAt)}</span
						>
						<form method="POST" action="?/move" use:enhance class="flex gap-0.5">
							<input type="hidden" name="id" value={c.id} />
							<button
								class="btn btn-ghost btn-sm"
								name="dir"
								value="up"
								disabled={i === 0}
								title="Move up">↑</button
							>
							<button
								class="btn btn-ghost btn-sm"
								name="dir"
								value="down"
								disabled={i === data.chapters.length - 1}
								title="Move down">↓</button
							>
						</form>
					</li>
				{/each}
			</ol>
		{:else}
			<p class="muted mb-3">No chapters yet.</p>
		{/if}
		<form method="POST" action="?/addChapter" use:enhance class="mt-4 flex gap-2">
			<input class="input" name="title" placeholder="New chapter title (optional)" />
			<button class="btn btn-primary" type="submit">+ Chapter</button>
		</form>
	</section>

	<aside class="card self-start" data-role="cast">
		<h2 class="mb-3 text-sm font-semibold tracking-wide text-slate-400 uppercase">
			Cast &amp; places
		</h2>
		{#if data.cast.length}
			<ul class="space-y-1.5 text-sm">
				{#each data.cast as e (e.elementId)}
					<li class="flex items-center justify-between gap-2">
						<a href="{base}/e/{e.slug}" class="min-w-0 truncate text-slate-200 hover:text-amber-300"
							>{e.icon} {e.name}</a
						>
						<span
							class="shrink-0 text-xs text-slate-500"
							title={e.roles.map((r) => ROLE_LABELS[r]).join(', ')}
							>{e.chapters} ch{e.roles.includes('pov') ? ' · POV' : ''}</span
						>
					</li>
				{/each}
			</ul>
		{:else}
			<p class="muted text-xs">
				Elements referenced by chapters (POV, location, cast, or [[mentions]]) show up here.
			</p>
		{/if}
	</aside>
</div>
