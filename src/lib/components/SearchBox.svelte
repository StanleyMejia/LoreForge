<script lang="ts">
	import { goto } from '$app/navigation';
	import { snippetHtml } from '$lib/snippet';

	interface Hit {
		title: string;
		href: string;
		icon: string;
		subtitle: string;
		snippet: string;
	}
	let { base, initial = '' }: { base: string; initial?: string } = $props();

	// svelte-ignore state_referenced_locally
	let q = $state(initial);
	let hits: Hit[] = $state([]);
	let open = $state(false);
	let selected = $state(0);
	let timer: ReturnType<typeof setTimeout> | undefined;

	function schedule() {
		clearTimeout(timer);
		if (q.trim().length < 2) {
			hits = [];
			open = false;
			return;
		}
		timer = setTimeout(async () => {
			try {
				const r = await fetch(`${base}/api/search?q=${encodeURIComponent(q.trim())}`);
				hits = r.ok ? await r.json() : [];
			} catch {
				hits = [];
			}
			selected = 0;
			open = hits.length > 0;
		}, 200);
	}
	function submit() {
		open = false;
		void goto(`${base}/search?q=${encodeURIComponent(q.trim())}`);
	}
	function onKeydown(e: KeyboardEvent) {
		if (open && e.key === 'ArrowDown') {
			e.preventDefault();
			selected = (selected + 1) % hits.length;
		} else if (open && e.key === 'ArrowUp') {
			e.preventDefault();
			selected = (selected - 1 + hits.length) % hits.length;
		} else if (e.key === 'Enter') {
			e.preventDefault();
			if (open && hits[selected]) {
				open = false;
				void goto(hits[selected].href);
			} else submit();
		} else if (e.key === 'Escape') open = false;
	}
</script>

<div class="relative px-3 pt-3" data-role="search-box">
	<input
		class="input"
		type="search"
		placeholder="Search world…"
		bind:value={q}
		oninput={schedule}
		onkeydown={onKeydown}
		onfocus={() => (open = hits.length > 0)}
		onblur={() => setTimeout(() => (open = false), 150)}
		autocomplete="off"
	/>
	{#if open}
		<ul
			class="absolute right-3 left-3 z-30 mt-1 overflow-hidden rounded-md border border-slate-700 bg-slate-900 shadow-xl"
		>
			{#each hits as h, i (i)}
				<li>
					<a
						href={h.href}
						class="block px-3 py-1.5 text-sm {i === selected
							? 'bg-amber-600/20'
							: 'hover:bg-slate-800'}"
						onmousedown={(e) => e.preventDefault()}
					>
						<div class="flex items-baseline gap-1.5">
							<span>{h.icon}</span><span class="truncate text-slate-100">{h.title}</span><span
								class="ml-auto shrink-0 text-[10px] text-slate-500">{h.subtitle}</span
							>
						</div>
						{#if h.snippet.trim()}<div class="snippet truncate text-xs text-slate-400">
								{@html snippetHtml(h.snippet)}
							</div>{/if}
					</a>
				</li>
			{/each}
			<li>
				<button
					type="button"
					class="w-full px-3 py-1.5 text-left text-xs text-amber-400 hover:bg-slate-800"
					onmousedown={(e) => {
						e.preventDefault();
						submit();
					}}>All results for “{q}” →</button
				>
			</li>
		</ul>
	{/if}
</div>
