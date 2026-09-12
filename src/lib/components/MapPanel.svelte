<script lang="ts">
	import ImageField from './ImageField.svelte';
	import { newId, type MapPanel as MapPanelData, type MapPin } from '$lib/types';

	interface IndexItem {
		id: string;
		slug: string;
		name: string;
		summary?: string;
		typeName?: string;
		icon: string;
	}
	/** Pin as prepared for viewing: linked element resolved. */
	export interface ViewPin extends MapPin {
		element: { name: string; slug: string; icon: string; summary: string } | null;
		/** The target has a map of its own, so clicking leads further in. */
		childMap?: boolean;
	}
	interface Props {
		mode: 'view' | 'edit';
		base: string; // world base, e.g. /w/my-world
		// view
		imageUrl?: string;
		pins?: ViewPin[];
		highlight?: string;
		// edit
		panel?: MapPanelData;
		index?: IndexItem[];
	}
	let {
		mode,
		base,
		imageUrl = '',
		pins = [],
		highlight = '',
		panel = $bindable(),
		index = []
	}: Props = $props();

	// The image + pins live in a layer that is translated/scaled for pan & zoom.
	let container: HTMLDivElement | undefined = $state();
	let scale = $state(1);
	let tx = $state(0);
	let ty = $state(0);
	let hover: string | null = $state(null);
	let selected: string | null = $state(null);
	let linkQuery = $state('');

	// pointer interaction state (not reactive)
	let dragging = $state(false);
	let moved = false;
	let dragPin: string | null = null;
	let downPin: string | null = null;
	/** Offset between the pointer and the pin's anchor when a drag starts, so it doesn't jump. */
	let dragOffset = { x: 0, y: 0 };
	let startX = 0;
	let startY = 0;
	let startTx = 0;
	let startTy = 0;

	const src = $derived(mode === 'edit' ? (panel?.imageUrl ?? '') : imageUrl);
	const shownPins = $derived<(MapPin & { element?: ViewPin['element'] })[]>(
		mode === 'edit' ? (panel?.pins ?? []) : pins
	);
	const byId = $derived(new Map(index.map((e) => [e.id, e])));
	const linkCandidates = $derived.by(() => {
		const q = linkQuery.trim().toLowerCase();
		if (!q) return [];
		return index.filter((e) => e.name.toLowerCase().includes(q)).slice(0, 8);
	});
	const selectedPin = $derived(
		mode === 'edit' && panel ? (panel.pins.find((p) => p.id === selected) ?? null) : null
	);

	const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

	function zoomAt(factor: number, cx?: number, cy?: number) {
		if (!container) return;
		const rect = container.getBoundingClientRect();
		const px = cx ?? rect.width / 2;
		const py = cy ?? rect.height / 2;
		const ns = clamp(scale * factor, 0.5, 8);
		tx = px - (px - tx) * (ns / scale);
		ty = py - (py - ty) * (ns / scale);
		scale = ns;
	}
	function reset() {
		scale = 1;
		tx = 0;
		ty = 0;
	}
	function onWheel(e: WheelEvent) {
		e.preventDefault();
		if (!container) return;
		const rect = container.getBoundingClientRect();
		zoomAt(e.deltaY < 0 ? 1.15 : 1 / 1.15, e.clientX - rect.left, e.clientY - rect.top);
	}
	/** Image-relative fraction for a pointer position. */
	function toFraction(e: PointerEvent): { x: number; y: number } | null {
		if (!container) return null;
		const img = container.querySelector('img');
		if (!img) return null;
		const r = img.getBoundingClientRect();
		if (!r.width || !r.height) return null;
		return {
			x: clamp((e.clientX - r.left) / r.width, 0, 1),
			y: clamp((e.clientY - r.top) / r.height, 0, 1)
		};
	}
	function onPointerDown(e: PointerEvent) {
		if (e.button !== 0) return;
		// Remember the pin under the pointer: once the container captures the pointer, later
		// events report the container as their target rather than the pin.
		const pinEl = (e.target as HTMLElement).closest('[data-pin]') as HTMLElement | null;
		downPin = pinEl ? pinEl.dataset.pin! : null;
		dragPin = mode === 'edit' ? downPin : null;
		dragOffset = { x: 0, y: 0 };
		if (dragPin && panel) {
			const f = toFraction(e);
			const pin = panel.pins.find((p) => p.id === dragPin);
			if (f && pin) dragOffset = { x: pin.x - f.x, y: pin.y - f.y };
		}
		dragging = true;
		moved = false;
		startX = e.clientX;
		startY = e.clientY;
		startTx = tx;
		startTy = ty;
		container?.setPointerCapture(e.pointerId);
	}
	function onPointerMove(e: PointerEvent) {
		if (!dragging) return;
		const dx = e.clientX - startX;
		const dy = e.clientY - startY;
		if (Math.abs(dx) + Math.abs(dy) > 3) moved = true;
		if (dragPin && panel) {
			const f = toFraction(e);
			const pin = panel.pins.find((p) => p.id === dragPin);
			if (f && pin) {
				pin.x = clamp(f.x + dragOffset.x, 0, 1);
				pin.y = clamp(f.y + dragOffset.y, 0, 1);
			}
			return;
		}
		tx = startTx + dx;
		ty = startTy + dy;
	}
	function onPointerUp(e: PointerEvent) {
		if (!dragging) return;
		dragging = false;
		container?.releasePointerCapture(e.pointerId);
		if (dragPin) {
			selected = dragPin;
			dragPin = null;
			downPin = null;
			return;
		}
		if (moved) {
			downPin = null;
			return;
		}
		// A plain click.
		if (downPin) {
			const id = downPin;
			downPin = null;
			if (mode === 'edit') selected = id;
			else {
				const el = pins.find((p) => p.id === id)?.element;
				if (el) location.href = `${base}/e/${el.slug}`;
			}
			return;
		}
		if (mode === 'edit' && panel && src) {
			const f = toFraction(e);
			if (!f) return;
			const pin: MapPin = {
				id: newId(),
				x: f.x,
				y: f.y,
				label: '',
				elementId: '',
				color: '#f59e0b'
			};
			panel.pins.push(pin);
			selected = pin.id;
		}
	}
	function removePin(id: string) {
		if (!panel) return;
		panel.pins = panel.pins.filter((p) => p.id !== id);
		if (selected === id) selected = null;
	}
	function pinTitle(p: MapPin & { element?: ViewPin['element'] }) {
		const el = mode === 'edit' ? byId.get(p.elementId) : p.element;
		return [p.label, el ? `${el.icon} ${el.name}` : ''].filter(Boolean).join(' · ') || 'Pin';
	}
	$effect(() => {
		if (highlight) selected = highlight;
	});
</script>

<div class="space-y-3" data-role="map-panel">
	{#if mode === 'edit' && panel}
		<ImageField bind:value={panel.imageUrl} {base} compact placeholder="Map image URL or upload" />
	{/if}

	{#if src}
		<div class="relative">
			<div
				bind:this={container}
				class="relative h-[60vh] min-h-72 w-full touch-none overflow-hidden rounded-md border border-slate-800 bg-slate-950 select-none {dragging
					? 'cursor-grabbing'
					: mode === 'edit'
						? 'cursor-crosshair'
						: 'cursor-grab'}"
				role="application"
				aria-label="Interactive map"
				onwheel={onWheel}
				onpointerdown={onPointerDown}
				onpointermove={onPointerMove}
				onpointerup={onPointerUp}
				onpointercancel={onPointerUp}
			>
				<div
					class="absolute top-0 left-0 w-full origin-top-left"
					style="transform: translate({tx}px, {ty}px) scale({scale})"
				>
					<img {src} alt="" class="block w-full max-w-none" draggable="false" />
					{#each shownPins as p (p.id)}
						<button
							type="button"
							data-pin={p.id}
							data-role="map-pin"
							data-child-map={'childMap' in p && p.childMap ? 'true' : undefined}
							class="absolute {selected === p.id ? 'z-20' : 'z-10'}"
							style="left: {p.x * 100}%; top: {p.y *
								100}%; transform: translate(-50%, -100%) scale({1 /
								scale}); transform-origin: bottom center"
							title={pinTitle(p)}
							onpointerenter={() => (hover = p.id)}
							onpointerleave={() => (hover = null)}
						>
							<svg
								width="28"
								height="36"
								viewBox="0 0 28 36"
								class="drop-shadow {selected === p.id ? 'animate-pulse' : ''}"
								aria-hidden="true"
							>
								<path
									d="M14 35 C14 35 2 21 2 13 A12 12 0 0 1 26 13 C26 21 14 35 14 35 Z"
									fill={p.color}
									stroke="#0f172a"
									stroke-width="1.5"
								/>
								<circle cx="14" cy="13" r="4.5" fill="#0f172a" fill-opacity="0.6" />
								{#if 'childMap' in p && p.childMap}
									<circle
										cx="14"
										cy="13"
										r="8"
										fill="none"
										stroke="#0f172a"
										stroke-opacity="0.75"
										stroke-width="1.5"
									/>
								{/if}
							</svg>
							{#if hover === p.id || selected === p.id}
								<span
									class="pointer-events-none absolute bottom-full left-1/2 mb-1 rounded bg-slate-900/95 px-2 py-1 text-xs whitespace-nowrap text-slate-100 shadow"
									style="transform: translateX(-50%)"
								>
									{pinTitle(p)}
								</span>
							{/if}
						</button>
					{/each}
				</div>
			</div>
			<div class="absolute top-2 right-2 flex gap-1">
				<button type="button" class="btn btn-sm" onclick={() => zoomAt(1.3)} title="Zoom in"
					>+</button
				>
				<button type="button" class="btn btn-sm" onclick={() => zoomAt(1 / 1.3)} title="Zoom out"
					>−</button
				>
				<button type="button" class="btn btn-sm" onclick={reset} title="Reset view">⟲</button>
			</div>
		</div>
		{#if mode === 'edit'}
			<p class="muted text-xs">
				Click on the map to add a pin, drag a pin to move it, scroll to zoom, drag the map to pan.
			</p>
		{/if}
	{:else}
		<p class="muted text-sm">
			{mode === 'edit' ? 'Upload or paste a map image to start placing pins.' : 'No map image yet.'}
		</p>
	{/if}

	{#if mode === 'edit' && selectedPin && panel}
		<div
			class="grid gap-2 rounded-md border border-amber-700/50 p-3 sm:grid-cols-[1fr_1fr_auto_auto]"
			data-role="pin-form"
		>
			<input class="input" placeholder="Pin label" bind:value={selectedPin.label} />
			<div class="relative">
				{#if selectedPin.elementId}
					{@const el = byId.get(selectedPin.elementId)}
					<div class="flex items-center gap-2">
						<span class="chip">{el?.icon ?? '❓'} {el?.name ?? 'missing element'}</span><button
							type="button"
							class="text-xs text-slate-500 hover:text-red-400"
							onclick={() => (selectedPin.elementId = '')}>unlink</button
						>
					</div>
				{:else}
					<input class="input" placeholder="Link to an element…" bind:value={linkQuery} />
					{#if linkCandidates.length}
						<ul
							class="absolute z-30 mt-1 w-full overflow-hidden rounded-md border border-slate-700 bg-slate-900 shadow-xl"
						>
							{#each linkCandidates as e (e.id)}
								<li>
									<button
										type="button"
										class="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-slate-800"
										onclick={() => {
											selectedPin.elementId = e.id;
											if (!selectedPin.label) selectedPin.label = e.name;
											linkQuery = '';
										}}>{e.icon} {e.name}</button
									>
								</li>
							{/each}
						</ul>
					{/if}
				{/if}
			</div>
			<input
				class="input h-9 w-12 p-1"
				type="color"
				bind:value={selectedPin.color}
				title="Pin colour"
			/>
			<button
				type="button"
				class="btn btn-ghost btn-sm text-red-300"
				onclick={() => removePin(selectedPin.id)}>Delete pin</button
			>
		</div>
	{/if}

	{#if shownPins.length}
		<ul class="flex flex-wrap gap-1.5" data-role="pin-list">
			{#each shownPins as p (p.id)}
				{@const el = mode === 'edit' ? byId.get(p.elementId) : p.element}
				<li>
					{#if mode === 'view' && el}
						<a
							href="{base}/e/{el.slug}"
							class="chip hover:border-amber-600"
							onmouseenter={() => (hover = p.id)}
							onmouseleave={() => (hover = null)}
							><span class="mr-1 inline-block h-2 w-2 rounded-full" style="background: {p.color}"
							></span>{p.label || el.name}{#if 'childMap' in p && p.childMap}<span
									class="ml-1 text-slate-500">→</span
								>{/if}</a
						>
					{:else}
						<button
							type="button"
							class="chip {selected === p.id ? 'border-amber-500' : ''}"
							onclick={() => (selected = p.id)}
							><span class="mr-1 inline-block h-2 w-2 rounded-full" style="background: {p.color}"
							></span>{p.label || el?.name || 'Pin'}</button
						>
					{/if}
				</li>
			{/each}
		</ul>
	{/if}
</div>
