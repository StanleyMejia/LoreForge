<script lang="ts">
	import { enhance } from '$app/forms';
	import PanelEditor from './PanelEditor.svelte';
	import type { Panel } from '$lib/types';
	import { TYPE_COLORS, TYPE_ICONS } from '$lib/defaults';

	interface Props {
		type: {
			id: string;
			key: string;
			name: string;
			singular: string;
			icon: string;
			color: string;
			panels: Panel[];
		};
		count: number;
		typeKeys: { key: string; name: string }[];
		first: boolean;
		last: boolean;
	}
	let { type, count, typeKeys, first, last }: Props = $props();

	let open = $state(false);
	// svelte-ignore state_referenced_locally
	let panels: Panel[] = $state(structuredClone($state.snapshot(type.panels)));
	let confirmDelete = $state(false);
	// svelte-ignore state_referenced_locally
	let meta = $state({
		name: type.name,
		singular: type.singular,
		icon: type.icon,
		color: type.color
	});
</script>

<div class="card">
	<div class="flex items-center gap-3">
		<span class="text-2xl">{type.icon}</span>
		<div class="min-w-0 flex-1">
			<div class="font-semibold">
				{type.name}
				<span class="muted font-normal"
					>· {count} element{count === 1 ? '' : 's'} · {type.panels.length} panels</span
				>
			</div>
			<div class="text-xs text-slate-500">key: {type.key}</div>
		</div>
		<form method="POST" action="?/moveType" use:enhance class="flex gap-0.5">
			<input type="hidden" name="id" value={type.id} />
			<button class="btn btn-ghost btn-sm" name="dir" value="up" disabled={first}>↑</button>
			<button class="btn btn-ghost btn-sm" name="dir" value="down" disabled={last}>↓</button>
		</form>
		<button class="btn btn-sm" onclick={() => (open = !open)}>{open ? 'Close' : 'Edit'}</button>
	</div>

	{#if open}
		<form
			method="POST"
			action="?/updateType"
			use:enhance
			class="mt-4 space-y-4 border-t border-slate-800 pt-4"
		>
			<input type="hidden" name="id" value={type.id} />
			<input type="hidden" name="panels" value={JSON.stringify(panels)} />
			<div class="grid gap-3 sm:grid-cols-4">
				<div>
					<label class="label" for="name-{type.id}">Plural name</label><input
						class="input"
						id="name-{type.id}"
						name="name"
						bind:value={meta.name}
						required
					/>
				</div>
				<div>
					<label class="label" for="singular-{type.id}">Singular</label><input
						class="input"
						id="singular-{type.id}"
						name="singular"
						bind:value={meta.singular}
					/>
				</div>
				<div>
					<label class="label" for="icon-{type.id}">Icon</label><input
						class="input"
						id="icon-{type.id}"
						name="icon"
						bind:value={meta.icon}
						list="icons"
					/>
				</div>
				<div>
					<label class="label" for="color-{type.id}">Colour</label><input
						class="input h-9 p-1"
						id="color-{type.id}"
						name="color"
						type="color"
						bind:value={meta.color}
						list="colors"
					/>
				</div>
			</div>

			<div>
				<span class="label">Default panels for new {type.name.toLowerCase()}</span>
				<p class="muted mb-3 text-xs">
					Changing the template affects new elements only. Existing elements keep their own panels.
				</p>
				<PanelEditor bind:panels index={[]} elementBase="" {typeKeys} template />
			</div>

			<div class="flex items-center justify-between">
				<button class="btn btn-primary" type="submit">Save type</button>
				{#if confirmDelete}
					<span class="flex items-center gap-2 text-xs text-red-300">
						Deletes {count} element{count === 1 ? '' : 's'} too.
						<button
							class="btn btn-danger btn-sm"
							type="submit"
							formaction="?/deleteType"
							formnovalidate>Really delete</button
						>
						<button
							class="btn btn-ghost btn-sm"
							type="button"
							onclick={() => (confirmDelete = false)}>Cancel</button
						>
					</span>
				{:else}
					<button class="btn btn-ghost btn-sm" type="button" onclick={() => (confirmDelete = true)}
						>Delete type</button
					>
				{/if}
			</div>
		</form>
	{/if}
</div>

<datalist id="icons"
	>{#each TYPE_ICONS as i (i)}<option value={i}></option>{/each}</datalist
>
<datalist id="colors"
	>{#each TYPE_COLORS as c (c)}<option value={c}></option>{/each}</datalist
>
