<script lang="ts">
	import { enhance } from '$app/forms';
	import PanelEditor from './PanelEditor.svelte';
	import { panelsFromTemplate, type Panel } from '$lib/types';

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
		icon: string;
	}
	interface Props {
		base: string;
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
		} | null;
		initialName?: string;
		error?: string;
		submitLabel?: string;
		cancelHref: string;
	}
	let {
		base,
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

	/** Switching type on a brand-new, untouched element re-applies that type's template. */
	function onTypeChange() {
		if (element || dirty) return;
		panels = panelsFromTemplate(types.find((t) => t.id === selectedType)?.panels ?? []);
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
			<input
				class="input"
				id="imageUrl"
				name="imageUrl"
				bind:value={imageUrl}
				placeholder="https://…"
			/>
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
