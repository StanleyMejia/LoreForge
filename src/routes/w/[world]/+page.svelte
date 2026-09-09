<script lang="ts">
	import ElementCard from '$lib/components/ElementCard.svelte';
	import { fmtNumber, timeAgo } from '$lib/format';

	let { data } = $props();
	const base = $derived(`/w/${data.world.slug}`);
	const total = $derived(data.types.reduce((n, t) => n + t.count, 0));
	const words = $derived(data.manuscripts.reduce((n, m) => n + m.wordCount, 0));
</script>

<header class="mb-8">
	<h1 class="text-3xl font-bold text-slate-50">{data.world.name}</h1>
	{#if data.world.description}<p class="muted mt-1 max-w-2xl">{data.world.description}</p>{/if}
	<p class="mt-2 text-xs text-slate-500">
		{fmtNumber(total)} elements · {data.eventCount} events · {data.manuscripts.length} manuscripts · {fmtNumber(
			words
		)} words written
	</p>
</header>

<section class="mb-10 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
	{#each data.types as t (t.id)}
		<a
			href="{base}/t/{t.key}"
			class="card flex items-center gap-3 transition hover:border-slate-600"
			style="border-left: 3px solid {t.color}"
		>
			<span class="text-2xl">{t.icon}</span>
			<div class="min-w-0">
				<div class="truncate font-semibold">{t.name}</div>
				<div class="text-xs text-slate-500">{t.count}</div>
			</div>
		</a>
	{/each}
</section>

<div class="grid gap-10 lg:grid-cols-[2fr_1fr]">
	<section>
		<h2 class="mb-3 text-sm font-semibold tracking-wide text-slate-400 uppercase">
			Recently edited
		</h2>
		{#if data.recent.length}
			<div class="grid gap-3 sm:grid-cols-2">
				{#each data.recent as el (el.id)}
					<ElementCard {base} {el} showType />
				{/each}
			</div>
		{:else}
			<div class="card">
				<p class="muted">
					Nothing here yet. Pick a category on the left and add your first element, or start with a
					<a class="text-amber-400" href="{base}/t/character">character</a>.
				</p>
			</div>
		{/if}
	</section>

	<aside class="space-y-8">
		<section data-role="continue-writing">
			<h2 class="mb-3 text-sm font-semibold tracking-wide text-slate-400 uppercase">Writing</h2>
			{#if data.latest}
				<a
					href="{base}/write/{data.latest.id}"
					class="card block border-amber-700/50 hover:border-amber-500"
				>
					<div class="text-xs text-amber-400">✍️ Continue writing</div>
					<div class="mt-0.5 truncate font-semibold text-slate-50">{data.latest.title}</div>
					<div class="text-xs text-slate-500">
						{data.latest.manuscriptTitle} · {fmtNumber(data.latest.wordCount)} words · {timeAgo(
							data.latest.updatedAt
						)}
					</div>
				</a>
			{:else}
				<a href="{base}/write" class="card block border-amber-700/50 hover:border-amber-500">
					<div class="text-xs text-amber-400">✍️ Start writing</div>
					<div class="muted mt-0.5 text-sm">Open the workspace and begin your first chapter.</div>
				</a>
			{/if}
		</section>

		<section>
			<h2 class="mb-3 text-sm font-semibold tracking-wide text-slate-400 uppercase">Manuscripts</h2>
			{#if data.manuscripts.length}
				<ul class="space-y-2">
					{#each data.manuscripts as m (m.id)}
						<li>
							<a href="{base}/m/{m.id}" class="card block hover:border-slate-600">
								<div class="font-semibold">{m.title}</div>
								<div class="text-xs text-slate-500">
									{m.chapterCount} chapters · {fmtNumber(m.wordCount)} words · {timeAgo(
										m.updatedAt
									)}
								</div>
							</a>
						</li>
					{/each}
				</ul>
			{:else}
				<a href="{base}/manuscripts" class="muted hover:text-slate-200">Start a manuscript →</a>
			{/if}
		</section>

		{#if data.tags.length}
			<section>
				<h2 class="mb-3 text-sm font-semibold tracking-wide text-slate-400 uppercase">Tags</h2>
				<div class="flex flex-wrap gap-1.5">
					{#each data.tags as t (t.tag)}
						<a
							href="{base}/search?tag={encodeURIComponent(t.tag)}"
							class="chip hover:border-amber-600"
							>{t.tag} <span class="ml-1 text-slate-500">{t.count}</span></a
						>
					{/each}
				</div>
			</section>
		{/if}
	</aside>
</div>
