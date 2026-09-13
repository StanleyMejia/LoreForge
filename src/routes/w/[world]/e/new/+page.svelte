<script lang="ts">
	import ElementForm from '$lib/components/ElementForm.svelte';

	let { data, form } = $props();
	const base = $derived(`/w/${data.world.slug}`);
</script>

<svelte:head><title>New element · {data.world.name}</title></svelte:head>

<h1 class="mb-6 text-2xl font-bold text-slate-50">New element</h1>
<ElementForm
	{base}
	action="{base}/e/new"
	types={data.types}
	typeId={data.typeId}
	index={data.index}
	initialName={data.initialName}
	error={form?.error}
	submitLabel="Create"
	cancelHref={base}
/>
