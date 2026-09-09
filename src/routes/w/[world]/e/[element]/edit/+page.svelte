<script lang="ts">
	import ElementForm from '$lib/components/ElementForm.svelte';

	let { data, form } = $props();
	const base = $derived(`/w/${data.world.slug}`);
</script>

<svelte:head><title>Edit {data.element.name} · {data.world.name}</title></svelte:head>

<h1 class="mb-6 text-2xl font-bold text-slate-50">
	Edit <span class="text-slate-400">{data.element.name}</span>
</h1>
{#key data.element.id}
	<ElementForm
		{base}
		types={data.types}
		typeId={data.element.typeId}
		index={data.index}
		element={data.element}
		error={form?.error}
		cancelHref="{base}/e/{data.element.slug}"
	/>
{/key}
