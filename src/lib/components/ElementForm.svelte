<script lang="ts">
	import { enhance } from '$app/forms';
	import PanelEditor from './PanelEditor.svelte';
	import ImageField from './ImageField.svelte';
	import { panelsFromTemplate, type Panel } from '$lib/types';
	import { ancestors } from '$lib/tree';

	interface TypeOpt {
		id: string;
		key: string;
		singular: string;
		icon: string;
		panels: Panel[];
	}
	interface IndexItem {
		id: string;
		slug: string;
		name: string;
		typeKey: string;
		typeName: string;
		parentId?: string | null;
		icon: string;
	}
	interface Props {
		base: string;
		/**
		 * Where to submit. Explicit rather than omitted: a form with no action targets whatever
		 * URL the browser is currently on, which posts to the wrong route if the address has
		 * drifted from the rendered page.
		 */
		action: string;
		types: TypeOpt[];
		typeId: string;
		index: IndexItem[];
		element?: {
			id: string;
			name: string;
			summary: string;
			panels: Panel[];
			tags: string[];
			imageUrl: string;
			parentId?: string | null;
		} | null;
		initialName?: string;
		error?: string;
		submitLabel?: string;
		cancelHref: string;
	}
	let {
		base,
		action,
		types,
		typeId,
		index,
		element = null,
		initialName = '',
		error,
		submitLabel = 'Save',
		cancelHref
	}: Props = $props();

	// svelte-ignore state_referenced_locally
	let selectedType = $state(typeId);
	// svelte-ignore state_referenced_locally
	let panels: Panel[] = $state(
		element
			? structuredClone($state.snapshot(element.panels))
			: panelsFromTemplate(types.find((t) => t.id === typeId)?.panels ?? [])
	);
	// Bound, not `value=`: this component holds a panels $state, and Svelte batches the form's
	// attribute effects, which resets an unbound value whenever the panels JSON changes.
	// svelte-ignore state_referenced_locally
	let parentId = $state(element?.parentId ?? '');
	const parentOf = $derived(new Map(index.map((e) => [e.id, e.parentId ?? null])));
	/** Anything but self and its own descendants, so the picker cannot offer a loop. */
	const parentGroups = $derived.by(() => {
		const ok = index.filter(
			(e) =>
				!element ||
				(e.id !== element.id && !ancestors(e.id, (x) => parentOf.get(x)).includes(element.id))
		);
		const out: { name: string; items: IndexItem[] }[] = [];
		for (const e of ok) {
			const group = out.find((g) => g.name === e.typeName);
			if (group) group.items.push(e);
			else out.push({ name: e.typeName, items: [e] });
		}
		return out;
	});
	let dirty = $state(false);
	// Bound inputs: Svelte batches this form's attribute updates into one effect, so unbound
	// value={...} inputs would be reset whenever the panels JSON changes.
	// svelte-ignore state_referenced_locally
	let name = $state(element?.name ?? initialName);
	// svelte-ignore state_referenced_locally
	let summary = $state(element?.summary ?? '');
	// svelte-ignore state_referenced_locally
	let tags = $state(element?.tags.join(', ') ?? '');
	// svelte-ignore state_referenced_locally
	let imageUrl = $state(element?.imageUrl ?? '');
	const typeKeys = $derived(types.map((t) => ({ key: t.key, name: t.singular })));

	// What the template put there, so any later change to the panels counts as an edit. Only
	// typing fires the form's input event; adding, removing or reordering with the panel buttons
	// or by drag does not, and switching type used to discard that work without asking.
	// svelte-ignore state_referenced_locally
	let seeded = JSON.stringify($state.snapshot(panels));

	/** Switching type on a brand-new, untouched element re-applies that type's template. */
	function onTypeChange() {
		if (element || dirty || JSON.stringify($state.snapshot(panels)) !== seeded) return;
		panels = panelsFromTemplate(types.find((t) => t.id === selectedType)?.panels ?? []);
		seeded = JSON.stringify($state.snapshot(panels));
	}
	let formEl: HTMLFormElement | undefined = $state();
	function onKeydown(e: KeyboardEvent) {
		if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
			e.preventDefault();
			formEl?.requestSubmit();
		}
	}
</script>

<svelte:window onkeydown={onKeydown} />

<form
	method="POST"
	{action}
	use:enhance
	class="space-y-6"
	bind:this={formEl}
	oninput={(e) => {
		if ((e.target as HTMLElement).id !== 'typeId') dirty = true;
	}}
>
	<input type="hidden" name="panels" value={JSON.stringify(panels)} />
	<div class="grid gap-4 sm:grid-cols-[1fr_220px]">
		<div>
			<label class="label" for="name">Name</label>
			<input class="input text-lg font-semibold" id="name" name="name" required bind:value={name} />
		</div>
		<div>
			<label class="label" for="typeId">Type</label>
			<select
				class="select"
				id="typeId"
				name="typeId"
				bind:value={selectedType}
				onchange={onTypeChange}
			>
				{#each types as t (t.id)}<option value={t.id}>{t.icon} {t.singular}</option>{/each}
			</select>
		</div>
	</div>

	<div>
		<label class="label" for="summary">Summary</label>
		<input
			class="input"
			id="summary"
			name="summary"
			bind:value={summary}
			placeholder="One or two sentences shown in lists and search"
		/>
	</div>

	<div class="grid gap-4 sm:grid-cols-2">
		<div>
			<label class="label" for="tags">Tags</label>
			<input
				class="input"
				id="tags"
				name="tags"
				bind:value={tags}
				placeholder="comma, separated, tags"
			/>
		</div>
		<div>
			<label class="label" for="imageUrl">Portrait / cover image URL</label>
			<ImageField
				bind:value={imageUrl}
				{base}
				id="imageUrl"
				name="imageUrl"
				placeholder="https://… or upload a portrait"
			/>
		</div>
		<div>
			<label class="label" for="parentId">Inside</label>
			<select class="select" id="parentId" name="parentId" bind:value={parentId}>
				<option value="">— nothing —</option>
				{#each parentGroups as g (g.name)}
					<optgroup label={g.name}>
						{#each g.items as e (e.id)}<option value={e.id}>{e.icon} {e.name}</option>{/each}
					</optgroup>
				{/each}
			</select>
		</div>
	</div>

	<PanelEditor bind:panels {index} elementBase="{base}/e/" {typeKeys} excludeId={element?.id} />

	{#if error}<p class="text-sm text-red-400">{error}</p>{/if}

	<div
		class="sticky bottom-0 -mx-4 flex items-center gap-2 border-t border-slate-800 bg-slate-950/95 px-4 py-3 backdrop-blur md:-mx-10 md:px-10"
	>
		<button class="btn btn-primary" type="submit">{submitLabel}</button>
		<a class="btn btn-ghost" href={cancelHref}>Cancel</a>
		<span class="muted ml-auto text-xs">Ctrl+S saves</span>
	</div>
</form>
