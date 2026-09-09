<script lang="ts">
	import { extractWikiLinks } from '$lib/markdown';
	import { ROLE_LABELS } from '$lib/types';

	interface IndexItem {
		id: string;
		slug: string;
		name: string;
		summary: string;
		typeKey: string;
		typeName: string;
		icon: string;
	}
	interface Peek {
		name: string;
		summary: string;
		imageUrl: string;
		type: { name: string; icon: string; color: string } | null;
		tags: string[];
		attributes: { label: string; value: string }[];
		lists: { title: string; items: string[] }[];
		excerpt: string;
		href: string;
	}
	interface Props {
		base: string;
		index: IndexItem[];
		events: { id: string; title: string; dateLabel: string }[];
		body: string;
		pov: string;
		location: string;
		eventId: string;
		cast: { elementId: string; note: string }[];
		oninsert: (text: string) => void;
	}
	let {
		base,
		index,
		events,
		body,
		pov = $bindable(),
		location = $bindable(),
		eventId = $bindable(),
		cast = $bindable(),
		oninsert
	}: Props = $props();

	let castQuery = $state('');
	let insertQuery = $state('');
	let peeked: string | null = $state(null);
	let peeks: Record<string, Peek | 'loading' | 'error'> = $state({});

	const byId = $derived(new Map(index.map((e) => [e.id, e])));
	const characters = $derived(index.filter((e) => e.typeKey === 'character'));
	const locations = $derived(index.filter((e) => e.typeKey === 'location'));

	const resolver = $derived.by(() => {
		const m = new Map<string, IndexItem>();
		for (const e of index) {
			m.set(e.name.toLowerCase(), e);
			m.set(e.slug.toLowerCase(), e);
		}
		return m;
	});
	/** Elements mentioned as [[links]] in the chapter body, plus names that don't resolve yet. */
	const mentions = $derived.by(() => {
		const found: IndexItem[] = [];
		const missing: string[] = [];
		const seen = new Set<string>();
		for (const n of extractWikiLinks(body)) {
			const hit = resolver.get(n.toLowerCase());
			if (hit) {
				if (!seen.has(hit.id)) {
					seen.add(hit.id);
					found.push(hit);
				}
			} else missing.push(n);
		}
		return { found, missing };
	});

	const castCandidates = $derived.by(() => {
		const q = castQuery.trim().toLowerCase();
		if (!q) return [];
		const used = new Set(cast.map((c) => c.elementId));
		return index.filter((e) => !used.has(e.id) && e.name.toLowerCase().includes(q)).slice(0, 8);
	});
	const insertCandidates = $derived.by(() => {
		const q = insertQuery.trim().toLowerCase();
		if (!q) return [];
		return index.filter((e) => e.name.toLowerCase().includes(q)).slice(0, 8);
	});

	async function peek(e: IndexItem) {
		if (peeked === e.id) {
			peeked = null;
			return;
		}
		peeked = e.id;
		if (peeks[e.id]) return;
		peeks[e.id] = 'loading';
		try {
			const r = await fetch(`${base}/api/elements/${encodeURIComponent(e.slug)}`);
			peeks[e.id] = r.ok ? await r.json() : 'error';
		} catch {
			peeks[e.id] = 'error';
		}
	}
</script>

{#snippet elementRow(e: IndexItem, extra?: string)}
	<li class="rounded-md border border-slate-800">
		<div class="flex items-center gap-2 px-2 py-1.5">
			<button
				type="button"
				class="flex min-w-0 flex-1 items-center gap-2 text-left"
				onclick={() => peek(e)}
				title="Show details"
			>
				<span>{e.icon}</span>
				<span class="min-w-0">
					<span class="block truncate text-sm font-medium text-slate-100">{e.name}</span>
					<span class="block truncate text-xs text-slate-500"
						>{extra ?? e.summary ?? e.typeName}</span
					>
				</span>
			</button>
			<button
				type="button"
				class="btn btn-ghost btn-sm"
				title="Insert [[{e.name}]] at cursor"
				onclick={() => oninsert(`[[${e.name}]]`)}>⤶</button
			>
			<a class="btn btn-ghost btn-sm" href="{base}/e/{e.slug}" title="Open element page">↗</a>
		</div>
		{#if peeked === e.id}
			{@const p = peeks[e.id]}
			<div class="border-t border-slate-800 px-3 py-2 text-xs">
				{#if p === 'loading' || !p}<span class="muted">Loading…</span>
				{:else if p === 'error'}<span class="text-red-400">Could not load.</span>
				{:else}
					{#if p.summary}<p class="mb-2 text-slate-300">{p.summary}</p>{/if}
					{#if p.attributes.length}
						<dl class="mb-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
							{#each p.attributes as a (a.label)}<dt class="text-slate-500">{a.label}</dt>
								<dd class="text-slate-200">{a.value}</dd>{/each}
						</dl>
					{/if}
					{#each p.lists as l (l.title)}
						<div class="mb-1">
							<span class="text-slate-500">{l.title}:</span>
							{l.items.join(' · ')}
						</div>
					{/each}
					{#if p.excerpt}<p class="mt-1 text-slate-400 italic">
							{p.excerpt}{p.excerpt.length >= 280 ? '…' : ''}
						</p>{/if}
				{/if}
			</div>
		{/if}
	</li>
{/snippet}

<div class="space-y-5 text-sm">
	<section>
		<h3 class="mb-2 text-xs font-semibold tracking-wide text-slate-400 uppercase">Scene details</h3>
		<div class="space-y-2">
			<div>
				<label class="label" for="ref-pov">Point of view</label>
				<select class="select" id="ref-pov" bind:value={pov}>
					<option value="">—</option>
					{#each characters.length ? characters : index as e (e.id)}<option value={e.id}
							>{e.icon} {e.name}</option
						>{/each}
				</select>
			</div>
			<div>
				<label class="label" for="ref-location">Location</label>
				<select class="select" id="ref-location" bind:value={location}>
					<option value="">—</option>
					{#each locations.length ? locations : index as e (e.id)}<option value={e.id}
							>{e.icon} {e.name}</option
						>{/each}
				</select>
			</div>
			<div>
				<label class="label" for="ref-event">Timeline event</label>
				<select class="select" id="ref-event" name="eventId" bind:value={eventId}>
					<option value="">—</option>
					{#each events as ev (ev.id)}<option value={ev.id}
							>{ev.dateLabel ? `${ev.dateLabel} · ` : ''}{ev.title}</option
						>{/each}
				</select>
			</div>
		</div>
	</section>

	<section>
		<h3 class="mb-2 text-xs font-semibold tracking-wide text-slate-400 uppercase">
			{ROLE_LABELS.cast} <span class="font-normal text-slate-600">· present in this chapter</span>
		</h3>
		{#if cast.length}
			<ul class="mb-2 space-y-1">
				{#each cast as c, i (c.elementId)}
					{@const e = byId.get(c.elementId)}
					{#if e}
						<li class="flex items-center gap-2">
							<span class="chip shrink-0">{e.icon} {e.name}</span>
							<input class="input py-1 text-xs" placeholder="Note (optional)" bind:value={c.note} />
							<button
								type="button"
								class="text-slate-600 hover:text-red-400"
								title="Remove"
								onclick={() => cast.splice(i, 1)}>✕</button
							>
						</li>
					{/if}
				{/each}
			</ul>
		{/if}
		<div class="relative">
			<input class="input" placeholder="Add to cast…" bind:value={castQuery} />
			{#if castCandidates.length}
				<ul
					class="absolute z-10 mt-1 w-full overflow-hidden rounded-md border border-slate-700 bg-slate-900 shadow-xl"
				>
					{#each castCandidates as e (e.id)}
						<li>
							<button
								type="button"
								class="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-slate-800"
								onclick={() => {
									cast.push({ elementId: e.id, note: '' });
									castQuery = '';
								}}
								>{e.icon} {e.name} <span class="text-xs text-slate-500">{e.typeName}</span></button
							>
						</li>
					{/each}
				</ul>
			{/if}
		</div>
	</section>

	<section>
		<h3 class="mb-2 text-xs font-semibold tracking-wide text-slate-400 uppercase">
			Insert reference
		</h3>
		<div class="relative">
			<input
				class="input"
				placeholder="Search elements, Enter inserts [[link]]"
				bind:value={insertQuery}
				onkeydown={(e) => {
					if (e.key === 'Enter' && insertCandidates[0]) {
						e.preventDefault();
						oninsert(`[[${insertCandidates[0].name}]]`);
						insertQuery = '';
					}
				}}
			/>
			{#if insertCandidates.length}
				<ul
					class="absolute z-10 mt-1 w-full overflow-hidden rounded-md border border-slate-700 bg-slate-900 shadow-xl"
				>
					{#each insertCandidates as e (e.id)}
						<li>
							<button
								type="button"
								class="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-slate-800"
								onclick={() => {
									oninsert(`[[${e.name}]]`);
									insertQuery = '';
								}}
								>{e.icon} {e.name} <span class="text-xs text-slate-500">{e.typeName}</span></button
							>
						</li>
					{/each}
				</ul>
			{/if}
		</div>
	</section>

	<section>
		<h3 class="mb-2 text-xs font-semibold tracking-wide text-slate-400 uppercase">
			Mentioned in text <span class="font-normal text-slate-600">· {mentions.found.length}</span>
		</h3>
		{#if mentions.found.length || mentions.missing.length}
			<ul class="space-y-1">
				{#each mentions.found as e (e.id)}{@render elementRow(e)}{/each}
				{#each mentions.missing as n (n)}
					<li
						class="flex items-center justify-between rounded-md border border-dashed border-red-900/60 px-2 py-1.5"
					>
						<span class="text-red-300 line-through">{n}</span>
						<a
							class="text-xs text-amber-400 hover:underline"
							href="{base}/e/new?name={encodeURIComponent(n)}"
							target="_blank"
							rel="noopener">Create ↗</a
						>
					</li>
				{/each}
			</ul>
		{:else}
			<p class="muted text-xs">
				Write <code class="text-amber-300">[[Name]]</code> in the text to reference an element. Type
				<code class="text-amber-300">[[</code> for autocomplete.
			</p>
		{/if}
	</section>
</div>
