<script lang="ts">
	import { enhance } from '$app/forms';
	import TypeEditor from '$lib/components/TypeEditor.svelte';

	let { data, form } = $props();
	const base = $derived(`/w/${data.world.slug}`);
	const counts = $derived(new Map(data.types.map((t) => [t.id, t.count])));
	const typeKeys = $derived(data.fullTypes.map((t) => ({ key: t.key, name: t.name })));
</script>

<svelte:head><title>Settings · {data.world.name}</title></svelte:head>

<h1 class="mb-6 text-2xl font-bold text-slate-50">⚙️ World settings</h1>

<div class="max-w-4xl space-y-10">
	<section>
		<h2 class="mb-3 text-sm font-semibold tracking-wide text-slate-400 uppercase">Details</h2>
		<form method="POST" action="?/world" use:enhance class="card space-y-3">
			<div>
				<label class="label" for="name">Name</label><input
					class="input"
					id="name"
					name="name"
					value={data.world.name}
					required
				/>
			</div>
			<div>
				<label class="label" for="description">Description</label><textarea
					class="textarea min-h-16"
					id="description"
					name="description">{data.world.description}</textarea
				>
			</div>
			{#if form?.error}<p class="text-sm text-red-400">{form.error}</p>{/if}
			<button class="btn btn-primary" type="submit">Save</button>
		</form>
	</section>

	<section>
		<h2 class="mb-3 text-sm font-semibold tracking-wide text-slate-400 uppercase">Element types</h2>
		<p class="muted mb-3">
			Each type has its own set of fields. Add types for anything your world needs: religions,
			ships, spells, languages.
		</p>
		<div class="space-y-3">
			{#each data.fullTypes as t, i (t.id)}
				<TypeEditor
					type={t}
					count={counts.get(t.id) ?? 0}
					{typeKeys}
					first={i === 0}
					last={i === data.fullTypes.length - 1}
				/>
			{/each}
		</div>
		<form
			method="POST"
			action="?/addType"
			use:enhance
			class="card mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_100px_100px_auto] sm:items-end"
		>
			<div>
				<label class="label" for="new-name">Plural name</label><input
					class="input"
					id="new-name"
					name="name"
					placeholder="Religions"
					required
				/>
			</div>
			<div>
				<label class="label" for="new-singular">Singular</label><input
					class="input"
					id="new-singular"
					name="singular"
					placeholder="Religion"
				/>
			</div>
			<div>
				<label class="label" for="new-icon">Icon</label><input
					class="input"
					id="new-icon"
					name="icon"
					placeholder="🕯️"
					list="icons"
				/>
			</div>
			<div>
				<label class="label" for="new-color">Colour</label><input
					class="input h-9 p-1"
					id="new-color"
					name="color"
					type="color"
					value="#84cc16"
					list="colors"
				/>
			</div>
			<button class="btn btn-primary" type="submit">+ Add type</button>
			{#if form?.typeError}<p class="text-sm text-red-400 sm:col-span-5">{form.typeError}</p>{/if}
		</form>
	</section>

	<section>
		<h2 class="mb-3 text-sm font-semibold tracking-wide text-slate-400 uppercase">Backup</h2>
		<div class="card flex items-center justify-between gap-4">
			<p class="muted">Download everything in this world as a single JSON file.</p>
			<a class="btn" href="{base}/export" data-sveltekit-reload>Export JSON</a>
		</div>
	</section>

	<section>
		<h2 class="mb-3 text-sm font-semibold tracking-wide text-red-400 uppercase">Danger zone</h2>
		<form method="POST" action="?/deleteWorld" use:enhance class="card space-y-3 border-red-900/60">
			<p class="muted">
				Deleting a world removes all of its elements, events and manuscripts. Export first.
			</p>
			<div>
				<label class="label" for="confirm"
					>Type <span class="text-slate-200">{data.world.name}</span> to confirm</label
				><input class="input" id="confirm" name="confirm" autocomplete="off" />
			</div>
			{#if form?.deleteError}<p class="text-sm text-red-400">{form.deleteError}</p>{/if}
			<button class="btn btn-danger" type="submit">Delete world</button>
		</form>
	</section>
</div>
