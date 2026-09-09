<script lang="ts">
	import { createMarkdown, makeResolver, type LinkTarget } from '$lib/markdown';

	interface Props {
		name: string;
		value: string;
		index: LinkTarget[];
		elementBase: string;
		placeholder?: string;
		rows?: number;
		serif?: boolean;
		showCount?: boolean;
	}

	let {
		name,
		value = $bindable(''),
		index,
		elementBase,
		placeholder = 'Write in Markdown. Link to anything with [[Name]].',
		rows = 18,
		serif = false,
		showCount = true
	}: Props = $props();

	let textarea: HTMLTextAreaElement | undefined = $state();
	let preview = $state(false);
	let query: string | null = $state(null);
	let cursor = $state(0);
	let selected = $state(0);

	const words = $derived((value.trim().match(/\S+/g) ?? []).length);
	const md = $derived(createMarkdown({ elementBase, resolve: makeResolver(index) }));
	const html = $derived(preview ? (md.parse(value, { async: false }) as string) : '');

	const suggestions = $derived.by(() => {
		if (query === null) return [];
		const q = query.toLowerCase();
		return index.filter((e) => e.name.toLowerCase().includes(q)).slice(0, 8);
	});

	function onInput() {
		if (!textarea) return;
		const pos = textarea.selectionStart;
		const before = value.slice(0, pos);
		const m = /\[\[([^\]\n]*)$/.exec(before);
		if (m) {
			query = m[1];
			cursor = pos;
			selected = 0;
		} else {
			query = null;
		}
	}

	function accept(e: LinkTarget) {
		if (!textarea || query === null) return;
		const start = cursor - query.length - 2;
		const after = value.slice(cursor);
		const closing = after.startsWith(']]') ? '' : ']]';
		value = value.slice(0, start) + `[[${e.name}${closing}` + after;
		const newPos = start + e.name.length + 4;
		query = null;
		queueMicrotask(() => {
			textarea?.focus();
			textarea?.setSelectionRange(newPos, newPos);
		});
	}

	function onKeydown(ev: KeyboardEvent) {
		if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 's') {
			ev.preventDefault();
			textarea?.form?.requestSubmit();
			return;
		}
		if (query === null || suggestions.length === 0) return;
		if (ev.key === 'ArrowDown') {
			ev.preventDefault();
			selected = (selected + 1) % suggestions.length;
		} else if (ev.key === 'ArrowUp') {
			ev.preventDefault();
			selected = (selected - 1 + suggestions.length) % suggestions.length;
		} else if (ev.key === 'Enter' || ev.key === 'Tab') {
			ev.preventDefault();
			accept(suggestions[selected]);
		} else if (ev.key === 'Escape') {
			query = null;
		}
	}
</script>

<div class="relative">
	<div class="mb-2 flex items-center justify-between gap-2">
		<div class="flex gap-1">
			<button
				type="button"
				class="btn btn-sm {preview ? 'btn-ghost' : ''}"
				onclick={() => (preview = false)}>Write</button
			>
			<button
				type="button"
				class="btn btn-sm {preview ? '' : 'btn-ghost'}"
				onclick={() => (preview = true)}>Preview</button
			>
		</div>
		<div class="text-xs text-slate-500">
			{#if showCount}<span>{words.toLocaleString()} words</span> ·
			{/if}<span>Ctrl+S saves</span>
		</div>
	</div>

	<!-- The textarea always exists so the form field is submitted even in preview mode. -->
	<textarea
		bind:this={textarea}
		bind:value
		{name}
		{rows}
		{placeholder}
		class="textarea font-mono text-[13px] leading-relaxed {serif ? 'md-serif' : ''}"
		class:hidden={preview}
		oninput={onInput}
		onkeydown={onKeydown}
		onblur={() => setTimeout(() => (query = null), 150)}
		spellcheck="true"></textarea>

	{#if preview}
		<div
			class="md {serif
				? 'md-serif'
				: ''} min-h-48 rounded-md border border-slate-800 bg-slate-900/40 p-4"
		>
			{#if value.trim()}{@html html}{:else}<p class="muted">Nothing to preview yet.</p>{/if}
		</div>
	{/if}

	{#if query !== null && suggestions.length}
		<ul
			class="absolute right-4 bottom-4 z-10 w-72 overflow-hidden rounded-md border border-slate-700 bg-slate-900 shadow-xl"
		>
			{#each suggestions as s, i (s.slug)}
				<li>
					<button
						type="button"
						class="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm {i === selected
							? 'bg-amber-600/20 text-amber-200'
							: 'hover:bg-slate-800'}"
						onmousedown={(e) => {
							e.preventDefault();
							accept(s);
						}}
					>
						<span>{s.icon ?? '📄'}</span><span class="truncate">{s.name}</span>
					</button>
				</li>
			{/each}
		</ul>
	{/if}
</div>
