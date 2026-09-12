<script lang="ts">
	let { data } = $props();
	const base = $derived(`/w/${data.world.slug}`);
	const mbase = $derived(`${base}/m/${data.manuscript.id}`);
</script>

<svelte:head><title>Read · {data.manuscript.title}</title></svelte:head>

<div class="mx-auto max-w-6xl">
	<nav class="mb-6 flex items-center justify-between text-xs text-slate-500">
		<div>
			<a href="{base}/manuscripts" class="hover:text-slate-300">📖 Manuscripts</a>
			<span class="mx-1">/</span>
			<a href={mbase} class="hover:text-slate-300">{data.manuscript.title}</a>
			<span class="mx-1">/</span>
			<span class="text-slate-300">Read</span>
		</div>
		<span>{data.chapters.length} chapters · {data.total.toLocaleString('en')} words</span>
	</nav>

	<div class="grid gap-10 lg:grid-cols-[220px_1fr]">
		<aside class="self-start lg:sticky lg:top-8">
			<h2 class="mb-2 text-xs font-semibold tracking-wide text-slate-400 uppercase">Contents</h2>
			<ol class="space-y-1 text-sm">
				{#each data.chapters as c (c.id)}
					<li>
						<a href="#ch-{c.id}" class="block truncate text-slate-300 hover:text-amber-300"
							><span class="mr-1 text-slate-600">{c.index}.</span>{c.title}</a
						>
					</li>
				{/each}
			</ol>
		</aside>

		<article class="max-w-3xl">
			<h1 class="mb-10 font-serif text-4xl font-bold text-slate-50">{data.manuscript.title}</h1>
			{#each data.chapters as c (c.id)}
				<section id="ch-{c.id}" class="mb-14 scroll-mt-20">
					<header class="mb-5">
						<div class="text-xs tracking-wide text-slate-500 uppercase">Chapter {c.index}</div>
						<h2 class="font-serif text-2xl font-semibold text-slate-50">{c.title}</h2>
						{#if c.pov || c.location || c.event}
							<div class="mt-2 flex flex-wrap gap-1.5 text-xs">
								{#if c.pov}<a
										class="chip hover:border-amber-600"
										href="{base}/e/{c.pov.slug}"
										title="Point of view">👁 {c.pov.name}</a
									>{/if}
								{#if c.location}<a
										class="chip hover:border-amber-600"
										href="{base}/e/{c.location.slug}"
										title="Location">{c.location.icon} {c.location.name}</a
									>{/if}
								{#if c.event}<a
										class="chip hover:border-amber-600"
										href="{base}/timeline#{c.event.id}"
										title="Timeline">🕰️ {c.event.dateLabel || c.event.title}</a
									>{/if}
							</div>
						{/if}
					</header>
					{#if c.html.trim()}
						<div class="md md-serif">{@html c.html}</div>
					{:else}
						<p class="muted italic">This chapter has no text yet.</p>
					{/if}
					<p class="mt-4 text-right text-xs text-slate-600">
						<a href="{mbase}/c/{c.id}" class="hover:text-amber-300">Edit chapter ✎</a> ·
						{c.wordCount.toLocaleString('en')} words · {c.status}
					</p>
				</section>
			{:else}
				<p class="muted">No chapters yet.</p>
			{/each}
		</article>
	</div>
</div>
