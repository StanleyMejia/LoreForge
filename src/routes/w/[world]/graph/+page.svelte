<script lang="ts">
	import { onMount } from 'svelte';

	let { data } = $props();
	const base = $derived(`/w/${data.world.slug}`);

	type Node = (typeof data.nodes)[number] & {
		x: number;
		y: number;
		vx: number;
		vy: number;
		degree: number;
	};
	let nodes: Node[] = $state([]);
	let showMentions = $state(true);
	let hover: string | null = $state(null);
	let W = $state(900);
	let H = $state(600);
	let container: HTMLDivElement | undefined = $state();

	const edges = $derived(data.edges.filter((e) => showMentions || e.kind === 'relationship'));
	const byId = $derived(new Map(nodes.map((n) => [n.id, n])));
	const visibleNodes = $derived.by(() => {
		const linked = new Set<string>();
		for (const e of edges) {
			linked.add(e.source);
			linked.add(e.target);
		}
		return nodes.filter((n) => linked.has(n.id));
	});

	/** Small force-directed layout: repulsion + springs + centring. Runs a fixed number of ticks. */
	function layout() {
		const ids = new Set(visibleNodes.map((n) => n.id));
		const es = edges.filter((e) => ids.has(e.source) && ids.has(e.target));
		const ns = visibleNodes;
		for (const n of ns) n.degree = 0;
		for (const e of es) {
			byId.get(e.source)!.degree++;
			byId.get(e.target)!.degree++;
		}
		for (let t = 0; t < 300; t++) {
			const k = 1 - t / 300;
			for (let i = 0; i < ns.length; i++) {
				for (let j = i + 1; j < ns.length; j++) {
					const a = ns[i],
						b = ns[j];
					let dx = a.x - b.x,
						dy = a.y - b.y;
					let d2 = dx * dx + dy * dy || 0.01;
					const f = (2600 / d2) * k;
					dx *= f;
					dy *= f;
					a.vx += dx;
					a.vy += dy;
					b.vx -= dx;
					b.vy -= dy;
				}
			}
			for (const e of es) {
				const a = byId.get(e.source)!,
					b = byId.get(e.target)!;
				const dx = b.x - a.x,
					dy = b.y - a.y;
				const d = Math.sqrt(dx * dx + dy * dy) || 1;
				const f = ((d - 110) / d) * 0.05 * k;
				a.vx += dx * f;
				a.vy += dy * f;
				b.vx -= dx * f;
				b.vy -= dy * f;
			}
			for (const n of ns) {
				n.vx += (W / 2 - n.x) * 0.005 * k;
				n.vy += (H / 2 - n.y) * 0.005 * k;
				n.x += n.vx * 0.5;
				n.y += n.vy * 0.5;
				n.vx *= 0.6;
				n.vy *= 0.6;
				n.x = Math.max(30, Math.min(W - 30, n.x));
				n.y = Math.max(30, Math.min(H - 30, n.y));
			}
		}
		nodes = [...nodes];
	}

	onMount(() => {
		W = container?.clientWidth ?? 900;
		H = Math.max(500, Math.round(W * 0.66));
		nodes = data.nodes.map((n, i) => {
			const a = (i / data.nodes.length) * Math.PI * 2;
			return {
				...n,
				x: W / 2 + Math.cos(a) * W * 0.3,
				y: H / 2 + Math.sin(a) * H * 0.3,
				vx: 0,
				vy: 0,
				degree: 0
			};
		});
		layout();
	});

	const neighbours = $derived.by(() => {
		if (!hover) return new Set<string>();
		const s = new Set<string>([hover]);
		for (const e of edges) {
			if (e.source === hover) s.add(e.target);
			if (e.target === hover) s.add(e.source);
		}
		return s;
	});
</script>

<svelte:head><title>Relationship map · {data.world.name}</title></svelte:head>

<header class="mb-4 flex flex-wrap items-end justify-between gap-3">
	<div>
		<h1 class="text-2xl font-bold text-slate-50">🕸️ Relationship map</h1>
		<p class="muted">
			Solid lines are explicit relationships; dotted lines are [[mentions]] in notes. Only connected
			elements are shown.
		</p>
	</div>
	<label class="flex items-center gap-2 text-sm"
		><input
			type="checkbox"
			class="rounded border-slate-600 bg-slate-900"
			bind:checked={showMentions}
			onchange={() => nodes.length && layout()}
		/> Show mentions</label
	>
</header>

<div bind:this={container} class="card overflow-hidden p-0">
	{#if visibleNodes.length === 0}
		<p class="muted p-6">
			Nothing to draw yet. Add relationships on element pages or link elements with [[double
			brackets]].
		</p>
	{:else}
		<svg viewBox="0 0 {W} {H}" class="block w-full" role="img" aria-label="Relationship graph">
			{#each edges as e, i (i)}
				{@const a = byId.get(e.source)}
				{@const b = byId.get(e.target)}
				{#if a && b}
					{@const dim =
						hover &&
						!(
							neighbours.has(e.source) &&
							neighbours.has(e.target) &&
							(e.source === hover || e.target === hover)
						)}
					<line
						x1={a.x}
						y1={a.y}
						x2={b.x}
						y2={b.y}
						stroke={e.kind === 'relationship' ? '#f59e0b' : '#475569'}
						stroke-width={e.kind === 'relationship' ? 1.5 : 1}
						stroke-dasharray={e.kind === 'mention' ? '3 4' : undefined}
						opacity={dim ? 0.1 : 0.7}
					/>
					{#if e.kind === 'relationship' && hover && (e.source === hover || e.target === hover)}
						<text
							x={(a.x + b.x) / 2}
							y={(a.y + b.y) / 2 - 4}
							fill="#fcd34d"
							font-size="10"
							text-anchor="middle">{e.label}</text
						>
					{/if}
				{/if}
			{/each}
			{#each visibleNodes as n (n.id)}
				{@const r = 8 + Math.min(10, n.degree * 1.5)}
				{@const dim = hover && !neighbours.has(n.id)}
				<a href="{base}/e/{n.slug}">
					<g
						opacity={dim ? 0.2 : 1}
						onmouseenter={() => (hover = n.id)}
						onmouseleave={() => (hover = null)}
						role="link"
						tabindex="-1"
					>
						<circle
							cx={n.x}
							cy={n.y}
							{r}
							fill={n.color}
							fill-opacity="0.25"
							stroke={n.color}
							stroke-width="1.5"
						/>
						<text x={n.x} y={n.y + 4} font-size={r} text-anchor="middle">{n.icon}</text>
						<text x={n.x} y={n.y + r + 12} fill="#e2e8f0" font-size="11" text-anchor="middle"
							>{n.name}</text
						>
					</g>
				</a>
			{/each}
		</svg>
	{/if}
</div>
