<script lang="ts">
	import type { Snippet } from 'svelte';
	import { page } from '$app/state';
	import MapPanel from '$lib/components/MapPanel.svelte';
	import { panelIcon, type ViewPanel } from '$lib/types';

	let { panels, base, empty }: { panels: ViewPanel[]; base: string; empty?: Snippet } = $props();
</script>

{#each panels as p (p.id)}
	<section class="card" id="panel-{p.id}">
		<h2 class="mb-3 flex items-center gap-2 font-serif text-lg font-semibold text-slate-50">
			<span class="text-base opacity-70">{panelIcon(p.kind)}</span>{p.title}
		</h2>
		{#if p.kind === 'info'}
			<dl class="grid gap-x-6 gap-y-3 sm:grid-cols-2">
				{#each p.rows as r (r.label)}
					<div class={r.kind === 'textarea' ? 'sm:col-span-2' : ''}>
						<dt class="text-xs font-semibold tracking-wide text-slate-500 uppercase">
							{r.label}
						</dt>
						<dd class="mt-0.5 text-sm whitespace-pre-line text-slate-200">
							{#if r.href}<a href={r.href} class="text-amber-400 hover:underline"
									>{r.icon} {r.value}</a
								>{:else}{r.value}{/if}
						</dd>
					</div>
				{/each}
			</dl>
		{:else if p.kind === 'text'}
			<div class="md">{@html p.html}</div>
		{:else if p.kind === 'list'}
			<ul class="divide-y divide-slate-800">
				{#each p.items as it, i (i)}
					<li class="py-2">
						{#if it.name}<div class="font-semibold text-slate-100">{it.name}</div>{/if}
						<div class="md text-sm">{@html it.html}</div>
					</li>
				{/each}
			</ul>
		{:else if p.kind === 'stats'}
			<ul class="space-y-2">
				{#each p.stats as st (st.name)}
					{@const pct = st.max > 0 ? Math.max(0, Math.min(100, (st.value / st.max) * 100)) : null}
					<li>
						<div class="flex justify-between text-sm">
							<span>{st.name}</span><span class="text-slate-400"
								>{st.value}{st.max > 0 ? ` / ${st.max}` : ''}</span
							>
						</div>
						{#if pct !== null}<div class="mt-1 h-1.5 rounded bg-slate-800">
								<div class="h-1.5 rounded bg-amber-500" style="width: {pct}%"></div>
							</div>{/if}
					</li>
				{/each}
			</ul>
		{:else if p.kind === 'links'}
			<ul class="grid gap-2 sm:grid-cols-2">
				{#each p.links as l (l.slug)}
					<li>
						<a
							href="{base}/e/{l.slug}"
							class="flex items-center gap-2 rounded-md border border-slate-800 px-3 py-2 hover:border-amber-600"
						>
							<span class="text-lg">{l.icon}</span>
							<span class="min-w-0"
								><span class="block truncate font-medium">{l.name}</span><span
									class="block truncate text-xs text-slate-500">{l.note || l.typeName}</span
								></span
							>
						</a>
					</li>
				{/each}
			</ul>
		{:else if p.kind === 'map'}
			<MapPanel
				mode="view"
				{base}
				imageUrl={p.imageUrl}
				pins={p.pins}
				highlight={page.url.searchParams.get('pin') ?? ''}
			/>
		{:else if p.kind === 'gallery'}
			<div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
				{#each p.images as img (img.url)}
					<figure>
						<a href={img.url} target="_blank" rel="noopener noreferrer"
							><img
								src={img.url}
								alt={img.caption}
								class="aspect-square w-full rounded-md object-cover"
								loading="lazy"
							/></a
						>
						{#if img.caption}<figcaption class="muted mt-1 text-xs">
								{img.caption}
							</figcaption>{/if}
					</figure>
				{/each}
			</div>
		{/if}
	</section>
{:else}
	{@render empty?.()}
{/each}
