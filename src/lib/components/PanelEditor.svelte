<script lang="ts">
	import MarkdownEditor from './MarkdownEditor.svelte';
	import ImageField from './ImageField.svelte';
	import MapPanel from './MapPanel.svelte';
	import {
		PANEL_KINDS,
		blankPanel,
		panelIcon,
		type FieldDef,
		type FieldKind,
		type Panel,
		type PanelKind
	} from '$lib/types';
	import { slugify } from '$lib/slug';

	interface IndexItem {
		id: string;
		slug: string;
		name: string;
		typeKey: string;
		icon: string;
	}
	interface Props {
		panels: Panel[];
		index: IndexItem[];
		elementBase: string;
		typeKeys: { key: string; name: string }[];
		/** Template mode edits structure only: titles, order, attribute definitions. */
		template?: boolean;
		excludeId?: string;
	}
	let {
		panels = $bindable(),
		index,
		elementBase,
		typeKeys,
		template = false,
		excludeId
	}: Props = $props();
	const worldBase = $derived(elementBase.replace(/\/e\/?$/, ''));

	let chooser = $state(false);
	let editingTitle: string | null = $state(null);
	let addingField: string | null = $state(null);
	let newField = $state({ label: '', kind: 'text' as FieldKind, ref: '', options: '' });
	let linkQuery: Record<string, string> = $state({});

	const FIELD_KINDS: { v: FieldKind; l: string }[] = [
		{ v: 'text', l: 'Text' },
		{ v: 'textarea', l: 'Long text' },
		{ v: 'number', l: 'Number' },
		{ v: 'select', l: 'Choice' },
		{ v: 'element', l: 'Element link' }
	];

	function add(kind: PanelKind) {
		panels.push(blankPanel(kind));
		chooser = false;
	}
	function move(i: number, d: number) {
		const j = i + d;
		if (j < 0 || j >= panels.length) return;
		[panels[i], panels[j]] = [panels[j], panels[i]];
	}
	function remove(i: number) {
		if (template || confirm(`Remove panel "${panels[i].title}"?`)) panels.splice(i, 1);
	}
	function addField(p: Panel) {
		if (p.kind !== 'info') return;
		const label = newField.label.trim();
		if (!label) return;
		let key = slugify(label).replace(/-/g, '_');
		while (p.fields.some((f) => f.key === key)) key += '_';
		const def: FieldDef = { key, label, kind: newField.kind };
		if (def.kind === 'select')
			def.options = newField.options
				.split(',')
				.map((s) => s.trim())
				.filter(Boolean);
		if (def.kind === 'element') def.ref = newField.ref;
		p.fields.push(def);
		newField = { label: '', kind: 'text', ref: '', options: '' };
		addingField = null;
	}
	/**
	 * Attribute reordering. Drag is the pleasant path; the arrows exist because a drag-only
	 * control is unusable by keyboard and awkward on a touchscreen.
	 */
	let dragField: { panel: string; from: number } | null = $state(null);
	let dropTarget: { panel: string; at: number } | null = $state(null);

	function moveField(p: Panel, from: number, to: number) {
		if (p.kind !== 'info') return;
		if (to < 0 || to >= p.fields.length || from === to) return;
		const [f] = p.fields.splice(from, 1);
		p.fields.splice(to, 0, f);
	}

	function onFieldDrop(p: Panel, to: number) {
		if (dragField && dragField.panel === p.id) moveField(p, dragField.from, to);
		dragField = null;
		dropTarget = null;
	}

	function removeField(p: Panel, i: number) {
		if (p.kind !== 'info') return;
		const f = p.fields[i];
		p.fields.splice(i, 1);
		delete p.values[f.key];
	}
	function elementOptions(f: FieldDef) {
		return index.filter((e) => e.id !== excludeId && (!f.ref || e.typeKey === f.ref));
	}
	function linkCandidates(p: Panel) {
		if (p.kind !== 'links') return [];
		const q = (linkQuery[p.id] ?? '').toLowerCase();
		const used = new Set(p.links.map((l) => l.elementId));
		return index
			.filter(
				(e) => e.id !== excludeId && !used.has(e.id) && (!q || e.name.toLowerCase().includes(q))
			)
			.slice(0, 8);
	}
	const nameOf = (id: string) => index.find((e) => e.id === id);
</script>

<div class="space-y-4">
	{#each panels as p, i (p.id)}
		<section class="card">
			<header class="mb-3 flex items-center gap-2">
				<span class="text-lg" title={p.kind}>{panelIcon(p.kind)}</span>
				{#if editingTitle === p.id}
					<input
						class="input flex-1 font-semibold"
						bind:value={p.title}
						onblur={() => (editingTitle = null)}
						onkeydown={(e) => e.key === 'Enter' && (e.preventDefault(), (editingTitle = null))}
					/>
				{:else}
					<button
						type="button"
						class="flex-1 truncate text-left font-serif text-lg font-semibold text-slate-50 hover:text-amber-300"
						title="Rename panel"
						onclick={() => (editingTitle = p.id)}>{p.title}</button
					>
				{/if}
				<div class="flex gap-0.5">
					<button
						type="button"
						class="btn btn-ghost btn-sm"
						onclick={() => move(i, -1)}
						disabled={i === 0}
						title="Move up">↑</button
					>
					<button
						type="button"
						class="btn btn-ghost btn-sm"
						onclick={() => move(i, 1)}
						disabled={i === panels.length - 1}
						title="Move down">↓</button
					>
					<button
						type="button"
						class="btn btn-ghost btn-sm text-red-300"
						onclick={() => remove(i)}
						title="Remove panel">✕</button
					>
				</div>
			</header>

			{#if p.kind === 'info'}
				<div class="grid gap-3 sm:grid-cols-2">
					{#each p.fields as f, fi (f.key)}
						<!-- svelte-ignore a11y_no_static_element_interactions -->
						<div
							class="{f.kind === 'textarea' ? 'sm:col-span-2' : ''} rounded-md transition
								{dragField?.panel === p.id && dragField.from === fi ? 'opacity-40' : ''}
								{dropTarget?.panel === p.id && dropTarget.at === fi ? 'ring-2 ring-amber-500/70' : ''}"
							ondragover={(e) => {
								if (dragField?.panel !== p.id) return;
								e.preventDefault();
								dropTarget = { panel: p.id, at: fi };
							}}
							ondragleave={() => {
								if (dropTarget?.panel === p.id && dropTarget.at === fi) dropTarget = null;
							}}
							ondrop={(e) => {
								e.preventDefault();
								onFieldDrop(p, fi);
							}}
						>
							<div class="flex items-center justify-between gap-1">
								<label class="label flex min-w-0 items-center gap-1.5" for="{p.id}-{f.key}">
									<span
										class="cursor-grab text-slate-600 select-none hover:text-slate-300 active:cursor-grabbing"
										draggable="true"
										role="button"
										tabindex="-1"
										aria-label="Drag to reorder {f.label}"
										title="Drag to reorder"
										ondragstart={(e) => {
											dragField = { panel: p.id, from: fi };
											e.dataTransfer?.setData('text/plain', f.key);
											if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
										}}
										ondragend={() => {
											dragField = null;
											dropTarget = null;
										}}>⠿</span
									><span class="truncate">{f.label}</span>
									{#if template}<span class="font-normal text-slate-500 normal-case"
											>· {FIELD_KINDS.find((k) => k.v === f.kind)?.l}{f.kind === 'element' && f.ref
												? ` → ${typeKeys.find((t) => t.key === f.ref)?.name ?? f.ref}`
												: ''}</span
										>{/if}</label
								>
								<span class="flex shrink-0 items-center gap-0.5">
									<button
										type="button"
										class="px-0.5 text-xs text-slate-600 hover:text-amber-300 disabled:opacity-30"
										disabled={fi === 0}
										title="Move up"
										onclick={() => moveField(p, fi, fi - 1)}>↑</button
									>
									<button
										type="button"
										class="px-0.5 text-xs text-slate-600 hover:text-amber-300 disabled:opacity-30"
										disabled={fi === p.fields.length - 1}
										title="Move down"
										onclick={() => moveField(p, fi, fi + 1)}>↓</button
									>
									<button
										type="button"
										class="px-0.5 text-xs text-slate-600 hover:text-red-400"
										title="Remove attribute"
										onclick={() => removeField(p, fi)}>✕</button
									>
								</span>
							</div>
							{#if template}
								{#if f.kind === 'select'}
									<input
										class="input"
										value={(f.options ?? []).join(', ')}
										placeholder="Options, comma separated"
										oninput={(e) =>
											(f.options = e.currentTarget.value
												.split(',')
												.map((s) => s.trim())
												.filter(Boolean))}
									/>
								{:else}
									<div class="muted text-xs">key: {f.key}</div>
								{/if}
							{:else if f.kind === 'textarea'}
								<textarea
									class="textarea min-h-20"
									id="{p.id}-{f.key}"
									bind:value={p.values[f.key]}
									rows="3"></textarea>
							{:else if f.kind === 'select'}
								<select class="select" id="{p.id}-{f.key}" bind:value={p.values[f.key]}>
									<option value="">—</option>
									{#each f.options ?? [] as o (o)}<option value={o}>{o}</option>{/each}
								</select>
							{:else if f.kind === 'element'}
								<select class="select" id="{p.id}-{f.key}" bind:value={p.values[f.key]}>
									<option value="">—</option>
									{#each elementOptions(f) as e (e.id)}<option value={e.id}
											>{e.icon} {e.name}</option
										>{/each}
								</select>
							{:else if f.kind === 'number'}
								<input
									class="input"
									id="{p.id}-{f.key}"
									type="number"
									step="any"
									bind:value={p.values[f.key]}
								/>
							{:else}
								<input class="input" id="{p.id}-{f.key}" type="text" bind:value={p.values[f.key]} />
							{/if}
						</div>
					{/each}
				</div>
				{#if addingField === p.id}
					<div
						class="mt-3 grid gap-2 rounded-md border border-dashed border-slate-700 p-3 sm:grid-cols-[1fr_140px_1fr_auto]"
					>
						<input
							class="input"
							placeholder="Attribute label"
							bind:value={newField.label}
							onkeydown={(e) => e.key === 'Enter' && (e.preventDefault(), addField(p))}
						/>
						<select class="select" bind:value={newField.kind}
							>{#each FIELD_KINDS as k (k.v)}<option value={k.v}>{k.l}</option>{/each}</select
						>
						{#if newField.kind === 'select'}
							<input
								class="input"
								placeholder="Options, comma separated"
								bind:value={newField.options}
							/>
						{:else if newField.kind === 'element'}
							<select class="select" bind:value={newField.ref}
								><option value="">Any element</option>{#each typeKeys as t (t.key)}<option
										value={t.key}>{t.name}</option
									>{/each}</select
							>
						{:else}<span></span>{/if}
						<div class="flex gap-1">
							<button type="button" class="btn btn-sm" onclick={() => addField(p)}>Add</button
							><button
								type="button"
								class="btn btn-ghost btn-sm"
								onclick={() => (addingField = null)}>✕</button
							>
						</div>
					</div>
				{:else}
					<button
						type="button"
						class="mt-3 text-xs text-amber-400 hover:underline"
						onclick={() => (addingField = p.id)}>+ Add attribute</button
					>
				{/if}
			{:else if p.kind === 'text'}
				{#if template}<p class="muted">Write down notes, backstories, and more.</p>
				{:else}<MarkdownEditor name="" bind:value={p.body} {index} {elementBase} rows={8} />{/if}
			{:else if p.kind === 'list'}
				{#if template}<p class="muted">Create organized lists.</p>
				{:else}
					<div class="space-y-2">
						{#each p.items as item, ii (ii)}
							<div
								class="grid gap-2 rounded-md border border-slate-800 p-2 sm:grid-cols-[200px_1fr_auto]"
							>
								<input class="input font-medium" placeholder="Item name" bind:value={item.name} />
								<textarea
									class="textarea min-h-10"
									rows="1"
									placeholder="Enter some text… ([[links]] work here)"
									bind:value={item.text}></textarea>
								<div class="flex gap-0.5">
									<button
										type="button"
										class="btn btn-ghost btn-sm"
										onclick={() => {
											if (ii > 0) [p.items[ii - 1], p.items[ii]] = [p.items[ii], p.items[ii - 1]];
										}}
										disabled={ii === 0}>↑</button
									>
									<button
										type="button"
										class="btn btn-ghost btn-sm text-red-300"
										onclick={() => p.items.splice(ii, 1)}>✕</button
									>
								</div>
							</div>
						{/each}
					</div>
					<button
						type="button"
						class="btn mt-3 w-full"
						onclick={() => p.items.push({ name: '', text: '' })}>Add list item</button
					>
				{/if}
			{:else if p.kind === 'stats'}
				{#if template}<p class="muted">Record numerical values.</p>
				{:else}
					<div class="space-y-2">
						{#each p.stats as st, si (si)}
							<div class="grid items-center gap-2 sm:grid-cols-[1fr_100px_100px_auto]">
								<input class="input" placeholder="Stat name" bind:value={st.name} />
								<input
									class="input"
									type="number"
									step="any"
									placeholder="Value"
									bind:value={st.value}
								/>
								<input
									class="input"
									type="number"
									step="any"
									placeholder="Max (opt)"
									bind:value={st.max}
								/>
								<button
									type="button"
									class="btn btn-ghost btn-sm text-red-300"
									onclick={() => p.stats.splice(si, 1)}>✕</button
								>
							</div>
						{/each}
					</div>
					<button
						type="button"
						class="btn mt-3 w-full"
						onclick={() => p.stats.push({ name: '', value: 0, max: 0 })}>Add stat</button
					>
				{/if}
			{:else if p.kind === 'links'}
				{#if template}<p class="muted">Link to other elements.</p>
				{:else}
					{#if p.links.length}
						<ul class="mb-3 space-y-1.5">
							{#each p.links as l, li (l.elementId)}
								{@const e = nameOf(l.elementId)}
								<li class="flex items-center gap-2">
									<span class="chip">{e?.icon ?? '❓'} {e?.name ?? 'missing'}</span>
									<input class="input" placeholder="Note (optional)" bind:value={l.note} />
									<button
										type="button"
										class="btn btn-ghost btn-sm text-red-300"
										onclick={() => p.links.splice(li, 1)}>✕</button
									>
								</li>
							{/each}
						</ul>
					{/if}
					<div class="relative">
						<input
							class="input"
							placeholder="Search elements to link…"
							bind:value={linkQuery[p.id]}
						/>
						{#if (linkQuery[p.id] ?? '').trim()}
							<ul
								class="absolute z-10 mt-1 w-full overflow-hidden rounded-md border border-slate-700 bg-slate-900 shadow-xl"
							>
								{#each linkCandidates(p) as e (e.id)}
									<li>
										<button
											type="button"
											class="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-slate-800"
											onclick={() => {
												p.links.push({ elementId: e.id, note: '' });
												linkQuery[p.id] = '';
											}}>{e.icon} {e.name}</button
										>
									</li>
								{:else}
									<li class="muted px-3 py-1.5 text-sm">No matches.</li>
								{/each}
							</ul>
						{/if}
					</div>
				{/if}
			{:else if p.kind === 'map'}
				{#if template}<p class="muted">An image with pins linked to elements.</p>
				{:else}<MapPanel
						mode="edit"
						bind:panel={panels[i] as import('$lib/types').MapPanel}
						{index}
						base={worldBase}
					/>{/if}
			{:else if p.kind === 'gallery'}
				{#if template}<p class="muted">Add images or image galleries.</p>
				{:else}
					<div class="space-y-2">
						{#each p.images as img, gi (gi)}
							<div class="grid items-center gap-2 sm:grid-cols-[1fr_1fr_auto]">
								<ImageField
									bind:value={img.url}
									base={worldBase}
									compact
									placeholder="https://… or upload"
								/>
								<input class="input" placeholder="Caption" bind:value={img.caption} />
								<button
									type="button"
									class="btn btn-ghost btn-sm text-red-300"
									onclick={() => p.images.splice(gi, 1)}>✕</button
								>
							</div>
						{/each}
					</div>
					<button
						type="button"
						class="btn mt-3 w-full"
						onclick={() => p.images.push({ url: '', caption: '' })}>Add image</button
					>
				{/if}
			{/if}
		</section>
	{/each}

	<div class="relative">
		<button type="button" class="btn btn-primary" onclick={() => (chooser = !chooser)}
			>+ Panel</button
		>
		{#if chooser}
			<div class="mt-2 grid gap-2 sm:grid-cols-3">
				{#each PANEL_KINDS as k (k.kind)}
					<button
						type="button"
						class="card text-left hover:border-amber-600"
						onclick={() => add(k.kind)}
					>
						<div class="font-semibold">{k.icon} {k.label}</div>
						<div class="muted text-xs">{k.blurb}</div>
					</button>
				{/each}
			</div>
		{/if}
	</div>
</div>
