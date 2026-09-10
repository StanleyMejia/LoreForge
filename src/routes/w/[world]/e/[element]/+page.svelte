<script lang="ts">
	import { enhance } from '$app/forms';
	import { timeAgo } from '$lib/format';
	import { page } from '$app/state';
	import MapPanel from '$lib/components/MapPanel.svelte';
	import { panelIcon, ROLE_LABELS } from '$lib/types';

	let { data, form } = $props();
	const base = $derived(`/w/${data.world.slug}`);
	let confirmDelete = $state(false);
	let relQuery = $state('');
	let relToId = $state('');
	const byManuscript = $derived.by(() => {
		const out: { id: string; title: string; chapters: typeof data.appearances }[] = [];
		for (const a of data.appearances) {
			const last = out[out.length - 1];
			if (last && last.id === a.manuscriptId) last.chapters.push(a);
			else out.push({ id: a.manuscriptId, title: a.manuscriptTitle, chapters: [a] });
		}
		return out;
	});
	const roleClass: Record<string, string> = {
		pov: 'border-amber-600/70 text-amber-300',
		location: 'border-emerald-600/70 text-emerald-300',
		cast: 'border-sky-600/70 text-sky-300',
		mention: 'border-slate-700 text-slate-400'
	};
	const relOptions = $derived(
		data.index
			.filter(
				(e) =>
					e.id !== data.element.id &&
					(!relQuery || e.name.toLowerCase().includes(relQuery.toLowerCase()))
			)
			.slice(0, 50)
	);
</script>

<svelte:head><title>{data.element.name} · {data.world.name}</title></svelte:head>

<div class="mx-auto max-w-5xl">
	<nav class="mb-4 text-xs text-slate-500">
		<a href="{base}/t/{data.type.key}" class="hover:text-slate-300"
			>{data.type.icon} {data.type.name}</a
		>
		<span class="mx-1">/</span>
		<span class="text-slate-300">{data.element.name}</span>
	</nav>

	<header class="mb-6 flex flex-wrap items-start justify-between gap-4">
		<div class="flex items-start gap-4">
			{#if data.element.imageUrl}
				<img src={data.element.imageUrl} alt="" class="h-24 w-24 rounded-lg object-cover" />
			{:else}
				<div
					class="flex h-24 w-24 items-center justify-center rounded-lg text-4xl"
					style="background: {data.type.color}22"
				>
					{data.type.icon}
				</div>
			{/if}
			<div>
				<h1 class="font-serif text-3xl font-bold text-slate-50">{data.element.name}</h1>
				{#if data.element.summary}<p class="muted mt-1 max-w-2xl text-base">
						{data.element.summary}
					</p>{/if}
				<div class="mt-2 flex flex-wrap items-center gap-1.5">
					<span class="chip" style="border-color: {data.type.color}66">{data.type.singular}</span>
					{#each data.element.tags as t (t)}
						<a href="{base}/search?tag={encodeURIComponent(t)}" class="chip hover:border-amber-600"
							>{t}</a
						>
					{/each}
					<span class="ml-2 text-xs text-slate-500">updated {timeAgo(data.element.updatedAt)}</span>
				</div>
			</div>
		</div>
		{#if !data.readonly}
			<div class="flex gap-2">
				<a class="btn btn-primary" href="{base}/e/{data.element.slug}/edit">Edit</a>
				{#if confirmDelete}
					<form method="POST" action="?/delete" use:enhance>
						<button class="btn btn-danger" type="submit">Really delete</button>
					</form>
					<button class="btn btn-ghost" onclick={() => (confirmDelete = false)}>Cancel</button>
				{:else}
					<button class="btn btn-ghost" onclick={() => (confirmDelete = true)}>Delete</button>
				{/if}
			</div>
		{/if}
	</header>

	<div class="grid gap-8 lg:grid-cols-[1fr_300px]">
		<article class="space-y-4">
			{#each data.panels as p (p.id)}
				<section class="card" id="panel-{p.id}">
					<h2 class="mb-3 flex items-center gap-2 font-serif text-lg font-semibold text-slate-50">
						<span class="text-base opacity-70">{panelIcon(p.kind)}</span>{p.title}
					</h2>
					{#if p.kind === 'info'}
						<dl class="grid gap-x-6 gap-y-3 sm:grid-cols-2">
							{#each p.rows as r (r.label)}
								<div class={r.kind === 'textarea' ? 'sm:col-span-2' : ''}>
									<dt class="text-xs font-semibold tracking-wide text-slate-500 uppercase">
										{r.label}
									</dt>
									<dd class="mt-0.5 text-sm whitespace-pre-line text-slate-200">
										{#if r.href}<a href={r.href} class="text-amber-400 hover:underline"
												>{r.icon} {r.value}</a
											>{:else}{r.value}{/if}
									</dd>
								</div>
							{/each}
						</dl>
					{:else if p.kind === 'text'}
						<div class="md">{@html p.html}</div>
					{:else if p.kind === 'list'}
						<ul class="divide-y divide-slate-800">
							{#each p.items as it, i (i)}
								<li class="py-2">
									{#if it.name}<div class="font-semibold text-slate-100">{it.name}</div>{/if}
									<div class="md text-sm">{@html it.html}</div>
								</li>
							{/each}
						</ul>
					{:else if p.kind === 'stats'}
						<ul class="space-y-2">
							{#each p.stats as st (st.name)}
								{@const pct =
									st.max > 0 ? Math.max(0, Math.min(100, (st.value / st.max) * 100)) : null}
								<li>
									<div class="flex justify-between text-sm">
										<span>{st.name}</span><span class="text-slate-400"
											>{st.value}{st.max > 0 ? ` / ${st.max}` : ''}</span
										>
									</div>
									{#if pct !== null}<div class="mt-1 h-1.5 rounded bg-slate-800">
											<div class="h-1.5 rounded bg-amber-500" style="width: {pct}%"></div>
										</div>{/if}
								</li>
							{/each}
						</ul>
					{:else if p.kind === 'links'}
						<ul class="grid gap-2 sm:grid-cols-2">
							{#each p.links as l (l.slug)}
								<li>
									<a
										href="{base}/e/{l.slug}"
										class="flex items-center gap-2 rounded-md border border-slate-800 px-3 py-2 hover:border-amber-600"
									>
										<span class="text-lg">{l.icon}</span>
										<span class="min-w-0"
											><span class="block truncate font-medium">{l.name}</span><span
												class="block truncate text-xs text-slate-500">{l.note || l.typeName}</span
											></span
										>
									</a>
								</li>
							{/each}
						</ul>
					{:else if p.kind === 'map'}
						<MapPanel
							mode="view"
							{base}
							imageUrl={p.imageUrl}
							pins={p.pins}
							highlight={page.url.searchParams.get('pin') ?? ''}
						/>
					{:else if p.kind === 'gallery'}
						<div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
							{#each p.images as img (img.url)}
								<figure>
									<a href={img.url} target="_blank" rel="noopener noreferrer"
										><img
											src={img.url}
											alt={img.caption}
											class="aspect-square w-full rounded-md object-cover"
											loading="lazy"
										/></a
									>
									{#if img.caption}<figcaption class="muted mt-1 text-xs">
											{img.caption}
										</figcaption>{/if}
								</figure>
							{/each}
						</div>
					{/if}
				</section>
			{:else}
				<p class="muted">
					Nothing filled in yet. <a class="text-amber-400" href="{base}/e/{data.element.slug}/edit"
						>Open the editor</a
					> to start.
				</p>
			{/each}
		</article>

		<aside class="space-y-6" data-role="element-sidebar">
			<section class="card">
				<h2 class="mb-2 text-sm font-semibold tracking-wide text-slate-400 uppercase">
					Relationships
				</h2>
				{#if data.relationships.length}
					<ul class="mb-3 space-y-2">
						{#each data.relationships as r (r.id)}
							<li class="flex items-start justify-between gap-2 text-sm">
								<div class="min-w-0">
									<div class="text-xs text-slate-500">{r.label}</div>
									<a
										href="{base}/e/{r.other.slug}"
										class="font-medium text-slate-100 hover:text-amber-300"
										>{r.other.icon} {r.other.name}</a
									>
									{#if r.notes}<div class="text-xs text-slate-400">{r.notes}</div>{/if}
								</div>
								{#if !data.readonly}
									<form method="POST" action="?/removeRelationship" use:enhance>
										<input type="hidden" name="id" value={r.id} />
										<button class="text-slate-600 hover:text-red-400" title="Remove" type="submit"
											>✕</button
										>
									</form>
								{/if}
							</li>
						{/each}
					</ul>
				{:else}
					<p class="muted mb-3">None yet.</p>
				{/if}

				{#if !data.readonly}
					<details class="group">
						<summary class="cursor-pointer text-xs text-amber-400 hover:underline"
							>+ Add relationship</summary
						>
						<form method="POST" action="?/addRelationship" use:enhance class="mt-2 space-y-2">
							<input class="input" placeholder="Find element…" bind:value={relQuery} />
							<select class="select" name="toId" bind:value={relToId} required size="4">
								{#each relOptions as e (e.id)}<option value={e.id}>{e.icon} {e.name}</option>{/each}
							</select>
							<input class="input" name="label" placeholder="Label, e.g. mentor of" required />
							<input
								class="input"
								name="reverseLabel"
								placeholder="Reverse label, e.g. student of"
							/>
							<input class="input" name="notes" placeholder="Notes (optional)" />
							{#if form?.relError}<p class="text-xs text-red-400">{form.relError}</p>{/if}
							<button class="btn btn-sm" type="submit">Add</button>
						</form>
					</details>
				{/if}
			</section>

			{#if data.onMaps.length}
				<section class="card" data-role="on-maps">
					<h2 class="mb-2 text-sm font-semibold tracking-wide text-slate-400 uppercase">On maps</h2>
					<ul class="space-y-1 text-sm">
						{#each data.onMaps as m (m.mapId + m.pinId)}
							<li>
								<a
									href="{base}/e/{m.mapSlug}?pin={m.pinId}#panel-{m.panelId}"
									class="text-slate-200 hover:text-amber-300"
									>🗺️ {m.mapName}{#if m.label && m.label !== data.element.name}
										<span class="text-slate-500">· {m.label}</span>{/if}</a
								>
							</li>
						{/each}
					</ul>
				</section>
			{/if}

			<section class="card" data-role="appearances">
				<h2 class="mb-2 text-sm font-semibold tracking-wide text-slate-400 uppercase">
					Appears in
				</h2>
				{#if byManuscript.length}
					<div class="space-y-3">
						{#each byManuscript as m (m.id)}
							<div>
								<a
									href="{base}/m/{m.id}"
									class="text-xs font-semibold text-slate-300 hover:text-amber-300">📖 {m.title}</a
								>
								<ul class="mt-1 space-y-1 text-sm">
									{#each m.chapters as c (c.chapterId)}
										<li class="flex items-start justify-between gap-2">
											<a
												href="{base}/m/{m.id}/c/{c.chapterId}"
												class="min-w-0 truncate text-slate-200 hover:text-amber-300"
												><span class="text-slate-600">{c.chapterIndex}.</span> {c.chapterTitle}</a
											>
											<span class="flex shrink-0 gap-1">
												{#each c.roles as r (r)}<span
														class="rounded border px-1 text-[10px] uppercase {roleClass[r]}"
														>{ROLE_LABELS[r]}</span
													>{/each}
											</span>
										</li>
									{/each}
								</ul>
							</div>
						{/each}
					</div>
				{:else}
					<p class="muted">
						Not in any chapter yet. Set it as POV, location or cast in a chapter's reference panel,
						or mention it with <code class="text-amber-300">[[{data.element.name}]]</code>.
					</p>
				{/if}
			</section>

			<section class="card">
				<h2 class="mb-2 text-sm font-semibold tracking-wide text-slate-400 uppercase">
					Mentioned in
				</h2>
				{#if data.backlinks.length}
					<ul class="space-y-1 text-sm">
						{#each data.backlinks as b (b.kind + b.id)}
							<li>
								<a href={b.href} class="text-slate-200 hover:text-amber-300">{b.icon} {b.title}</a>
							</li>
						{/each}
					</ul>
				{:else}
					<p class="muted">
						Nothing links here yet. Write <code class="text-amber-300">[[{data.element.name}]]</code
						> anywhere to link it.
					</p>
				{/if}
			</section>
		</aside>
	</div>
</div>
