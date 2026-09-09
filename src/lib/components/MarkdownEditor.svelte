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
		/** Grow with the content instead of scrolling inside the box (writing workspace). */
		autogrow?: boolean;
		/** Larger, book-like type. */
		prose?: boolean;
	}

	let {
		name,
		value = $bindable(''),
		index,
		elementBase,
		placeholder = 'Write in Markdown. Link to anything with [[Name]].',
		rows = 18,
		serif = false,
		showCount = true,
		autogrow = false,
		prose = false
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

	/** Insert text at the caret (or replace the selection). Used by the reference panel. */
	export function insertAtCursor(text: string) {
		preview = false;
		if (!textarea) {
			value += text;
			return;
		}
		const start = textarea.selectionStart;
		const end = textarea.selectionEnd;
		// Keep the inserted reference a separate word: pad with a space when glued to text.
		const before = value.slice(0, start);
		const after = value.slice(end);
		const lead = before && !/[\s(\["]$/.test(before) ? ' ' : '';
		const trail = after && !/^[\s.,;:!?)\]"]/.test(after) ? ' ' : '';
		const snippet = lead + text + trail;
		value = before + snippet + after;
		const pos = start + snippet.length;
		queueMicrotask(() => {
			textarea?.focus();
			textarea?.setSelectionRange(pos, pos);
		});
	}

	/** Wrap the selection (or insert placeholder) with markdown markers, e.g. ** for bold. */
	function wrapSelection(marker: string, placeholder = 'text') {
		if (!textarea) return;
		const start = textarea.selectionStart;
		const end = textarea.selectionEnd;
		const selected = value.slice(start, end);
		const already =
			value.slice(start - marker.length, start) === marker &&
			value.slice(end, end + marker.length) === marker;
		if (already) {
			value = value.slice(0, start - marker.length) + selected + value.slice(end + marker.length);
			queueMicrotask(() => textarea?.setSelectionRange(start - marker.length, end - marker.length));
			return;
		}
		const inner = selected || placeholder;
		value = value.slice(0, start) + marker + inner + marker + value.slice(end);
		const a = start + marker.length;
		queueMicrotask(() => {
			textarea?.focus();
			textarea?.setSelectionRange(a, a + inner.length);
		});
	}

	function fit() {
		if (!autogrow || !textarea) return;
		textarea.style.height = 'auto';
		textarea.style.height = `${textarea.scrollHeight + 2}px`;
	}
	$effect(() => {
		void value;
		void preview;
		fit();
	});

	function onKeydown(ev: KeyboardEvent) {
		const mod = ev.ctrlKey || ev.metaKey;
		if (mod && ev.key.toLowerCase() === 's') {
			ev.preventDefault();
			textarea?.form?.requestSubmit();
			return;
		}
		if (mod && !ev.shiftKey && ev.key.toLowerCase() === 'b') {
			ev.preventDefault();
			wrapSelection('**', 'bold');
			return;
		}
		if (mod && !ev.shiftKey && ev.key.toLowerCase() === 'i') {
			ev.preventDefault();
			wrapSelection('*', 'italic');
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
		<div class="flex flex-wrap gap-1">
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
			{#if !preview}
				<span class="mx-1 w-px bg-slate-800"></span>
				<button
					type="button"
					class="btn btn-ghost btn-sm font-bold"
					title="Bold (Ctrl+B)"
					onclick={() => wrapSelection('**', 'bold')}>B</button
				>
				<button
					type="button"
					class="btn btn-ghost btn-sm italic"
					title="Italic (Ctrl+I)"
					onclick={() => wrapSelection('*', 'italic')}>I</button
				>
				<button
					type="button"
					class="btn btn-ghost btn-sm"
					title="Heading"
					onclick={() => insertAtCursor('\n## ')}>H</button
				>
				<button
					type="button"
					class="btn btn-ghost btn-sm"
					title="Quote"
					onclick={() => insertAtCursor('\n> ')}>❝</button
				>
				<button
					type="button"
					class="btn btn-ghost btn-sm"
					title="Scene break"
					onclick={() => insertAtCursor('\n\n* * *\n\n')}>* * *</button
				>
			{/if}
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
		class="textarea {prose
			? 'md-serif min-h-[60vh] resize-none border-0 bg-transparent px-0 text-[1.15rem] leading-[1.8] focus:ring-0'
			: 'font-mono text-[13px] leading-relaxed'} {serif && !prose ? 'md-serif' : ''} {autogrow
			? 'overflow-hidden'
			: ''}"
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
