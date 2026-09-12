<script lang="ts">
	import { enhance } from '$app/forms';
	import ElementCard from '$lib/components/ElementCard.svelte';
	import ElementTree from '$lib/components/ElementTree.svelte';

	let { data, form } = $props();
	const base = $derived(`/w/${data.world.slug}`);
	let filter = $state('');
	// The data decides, not a setting: a tree appears once anything has been nested.
	const nested = $derived(data.elements.some((e) => e.parentId));
	const shown = $derived(
		filter.trim()
			? data.elements.filter((e) => {
					const q = filter.toLowerCase();
					return (
						e.name.toLowerCase().includes(q) ||
						e.summary.toLowerCase().includes(q) ||
						e.tags.some((t) => t.toLowerCase().includes(q))
					);
				})
			: data.elements
	);
</script>

<svelte:head><title>{data.type.name} · {data.world.name}</title></svelte:head>

<header class="mb-6 flex flex-wrap items-end justify-between gap-4">
	<div>
		<h1 class="text-2xl font-bold text-slate-50">
			<span class="mr-2">{data.type.icon}</span>{data.type.name}
		</h1>
		<p class="muted">
			{data.elements.length}
			{data.elements.length === 1 ? data.type.singular.toLowerCase() : data.type.name.toLowerCase()}
		</p>
	</div>
	{#if !data.readonly}
		<a class="btn btn-primary" href="{base}/e/new?type={data.type.key}"
			>+ New {data.type.singular.toLowerCase()}</a
		>
	{/if}
</header>

<div class="mb-6 grid gap-3 sm:grid-cols-2">
	<input
		class="input"
		type="search"
		placeholder="Filter {data.type.name.toLowerCase()}…"
		bind:value={filter}
	/>
	{#if !data.readonly}
		<form method="POST" action="?/quickAdd" use:enhance class="flex gap-2">
			<input class="input" name="name" placeholder="Quick add: name, then Enter" required />
			<button class="btn" type="submit">Add</button>
		</form>
	{/if}
</div>
{#if form?.error}<p class="mb-4 text-sm text-red-400">{form.error}</p>{/if}

{#if shown.length && nested && !filter.trim()}
	<div class="card">
		<ElementTree items={shown} {base} />
	</div>
{:else if shown.length}
	<div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
		{#each shown as el (el.id)}
			<ElementCard {base} {el} />
		{/each}
	</div>
{:else}
	<div class="card">
		<p class="muted">No {data.type.name.toLowerCase()} yet{filter ? ' match that filter' : ''}.</p>
	</div>
{/if}
