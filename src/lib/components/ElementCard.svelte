<script lang="ts">
	interface Props {
		base: string;
		el: {
			slug: string;
			name: string;
			summary: string;
			tags: string[];
			imageUrl: string;
			typeIcon: string;
			typeName: string;
			typeColor: string;
		};
		showType?: boolean;
	}
	let { base, el, showType = false }: Props = $props();
</script>

<a
	href="{base}/e/{el.slug}"
	class="card flex gap-3 transition hover:border-slate-600 hover:bg-slate-900"
>
	{#if el.imageUrl}
		<img
			src={el.imageUrl}
			alt=""
			class="h-16 w-16 shrink-0 rounded-md object-cover"
			loading="lazy"
		/>
	{:else}
		<div
			class="flex h-16 w-16 shrink-0 items-center justify-center rounded-md text-2xl"
			style="background: {el.typeColor}22"
		>
			{el.typeIcon}
		</div>
	{/if}
	<div class="min-w-0 flex-1">
		<div class="flex items-baseline gap-2">
			<h3 class="truncate font-semibold text-slate-50">{el.name}</h3>
			{#if showType}<span class="text-xs text-slate-500">{el.typeName}</span>{/if}
		</div>
		{#if el.summary}<p class="muted mt-0.5 line-clamp-2">{el.summary}</p>{/if}
		{#if el.tags.length}
			<div class="mt-1.5 flex flex-wrap gap-1">
				{#each el.tags as t (t)}<span class="chip">{t}</span>{/each}
			</div>
		{/if}
	</div>
</a>
