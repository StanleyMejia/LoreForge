<script lang="ts">
	import { timeAgo } from '$lib/format';

	interface Row {
		id: string;
		label: string;
		bytes: number;
		delta: number;
		createdAt: Date;
		author: string | null;
		prevId?: string | null;
	}
	let {
		revisions,
		shownId = null,
		readonly = false,
		compare = false
	}: {
		revisions: Row[];
		shownId?: string | null;
		readonly?: boolean;
		/** Offer a comparison against the current text (prose only). */
		compare?: boolean;
	} = $props();

	/** Byte counts are the cheap honest signal: how much a save added or cut. */
	function size(bytes: number) {
		return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} kB`;
	}
</script>

<ul class="space-y-2">
	{#each revisions as r (r.id)}
		<li
			class="card flex flex-wrap items-center gap-x-3 gap-y-2"
			class:ring-1={shownId === r.id}
			class:ring-amber-500={shownId === r.id}
			data-role="revision"
		>
			<span class="text-sm text-slate-200">{timeAgo(r.createdAt)}</span>
			{#if r.label}<span class="chip" title="Kept version">{r.label}</span>{/if}
			<span class="muted text-xs">{size(r.bytes)}</span>
			{#if r.delta !== 0}
				<span class="text-xs {r.delta > 0 ? 'text-emerald-400' : 'text-red-400'}"
					>{r.delta > 0 ? '+' : '−'}{size(Math.abs(r.delta))}</span
				>
			{/if}
			{#if r.author}<span class="muted text-xs">by {r.author}</span>{/if}
			<span class="ml-auto flex items-center gap-2">
				<a class="btn btn-ghost btn-sm" href="?rev={r.id}">View</a>
				{#if compare}
					<a class="btn btn-ghost btn-sm" href="?rev={r.id}&vs=current" title="Compare with now"
						>Diff</a
					>
				{/if}
				{#if !readonly}
					<form method="POST" action="?/restore">
						<input type="hidden" name="id" value={r.id} />
						<button class="btn btn-sm" type="submit">Restore</button>
					</form>
				{/if}
			</span>
		</li>
	{/each}
</ul>
