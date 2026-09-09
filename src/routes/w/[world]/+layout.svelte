<script lang="ts">
	import { page } from '$app/state';

	let { data, children } = $props();
	let open = $state(false);

	const base = $derived(`/w/${data.world.slug}`);
	const path = $derived(page.url.pathname);
	const active = (href: string, exact = false) =>
		exact ? path === href : path === href || path.startsWith(href + '/');
</script>

<svelte:head><title>{data.world.name} · Loreforge</title></svelte:head>

<div class="flex min-h-screen">
	<!-- mobile top bar -->
	<div
		class="fixed inset-x-0 top-0 z-30 flex items-center gap-3 border-b border-slate-800 bg-slate-950/95 px-4 py-2 backdrop-blur md:hidden"
	>
		<button
			class="btn btn-ghost btn-sm"
			onclick={() => (open = !open)}
			aria-label="Toggle navigation">☰</button
		>
		<a href={base} class="truncate font-semibold">{data.world.name}</a>
	</div>

	<aside
		class="fixed inset-y-0 left-0 z-20 w-64 transform border-r border-slate-800 bg-slate-950 transition-transform md:static md:translate-x-0 {open
			? 'translate-x-0 pt-12'
			: '-translate-x-full'} md:pt-0"
	>
		<div class="flex h-full flex-col">
			<div class="border-b border-slate-800 px-4 py-4">
				<a href="/" class="text-xs tracking-wide text-slate-500 uppercase hover:text-slate-300"
					>← All worlds</a
				>
				<a href={base} class="mt-1 block truncate text-lg font-bold text-slate-50"
					>{data.world.name}</a
				>
			</div>

			<form action="{base}/search" class="px-3 pt-3">
				<input
					class="input"
					type="search"
					name="q"
					placeholder="Search world…"
					value={page.url.searchParams.get('q') ?? ''}
				/>
			</form>

			<nav class="flex-1 overflow-y-auto px-2 py-3 text-sm">
				<a href={base} class="nav {active(base, true) ? 'nav-active' : ''}"
					><span>🏠</span> Overview</a
				>

				<p class="mt-4 mb-1 px-2 text-[11px] font-semibold tracking-wide text-slate-500 uppercase">
					Elements
				</p>
				{#each data.types as t (t.id)}
					<a href="{base}/t/{t.key}" class="nav {active(`${base}/t/${t.key}`) ? 'nav-active' : ''}">
						<span>{t.icon}</span>
						<span class="flex-1 truncate">{t.name}</span>
						<span class="text-xs text-slate-500">{t.count}</span>
					</a>
				{/each}

				<p class="mt-4 mb-1 px-2 text-[11px] font-semibold tracking-wide text-slate-500 uppercase">
					Story
				</p>
				<a href="{base}/timeline" class="nav {active(`${base}/timeline`) ? 'nav-active' : ''}"
					><span>🕰️</span> Timeline</a
				>
				<a
					href="{base}/manuscripts"
					class="nav {active(`${base}/manuscripts`) || active(`${base}/m`) ? 'nav-active' : ''}"
					><span>📖</span> Manuscripts</a
				>
				<a href="{base}/graph" class="nav {active(`${base}/graph`) ? 'nav-active' : ''}"
					><span>🕸️</span> Relationship map</a
				>

				<p class="mt-4 mb-1 px-2 text-[11px] font-semibold tracking-wide text-slate-500 uppercase">
					World
				</p>
				<a href="{base}/settings" class="nav {active(`${base}/settings`) ? 'nav-active' : ''}"
					><span>⚙️</span> Settings</a
				>
				<a href="{base}/export" class="nav" data-sveltekit-reload><span>⬇️</span> Export JSON</a>
			</nav>
		</div>
	</aside>

	{#if open}
		<button
			class="fixed inset-0 z-10 bg-black/60 md:hidden"
			onclick={() => (open = false)}
			aria-label="Close navigation"
		></button>
	{/if}

	<main class="min-w-0 flex-1 px-4 pt-14 pb-16 md:px-10 md:pt-8">
		{@render children()}
	</main>
</div>
