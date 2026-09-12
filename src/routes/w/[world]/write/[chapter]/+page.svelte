<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import MarkdownEditor from '$lib/components/MarkdownEditor.svelte';
	import ChapterReferences from '$lib/components/ChapterReferences.svelte';
	import { CHAPTER_STATUSES } from '$lib/types';
	import { countWords } from '$lib/slug';

	let { data, form } = $props();
	const base = $derived(`/w/${data.world.slug}`);
	const api = $derived(`${base}/api/chapters/${data.chapter.id}`);

	// Editable copy of the chapter. Re-seeded whenever a different chapter is loaded.
	// svelte-ignore state_referenced_locally
	let title = $state(data.chapter.title);
	// svelte-ignore state_referenced_locally
	let synopsis = $state(data.chapter.synopsis);
	// svelte-ignore state_referenced_locally
	let body = $state(data.chapter.body);
	// svelte-ignore state_referenced_locally
	let status = $state(data.chapter.status);
	// svelte-ignore state_referenced_locally
	let eventId = $state(data.chapter.eventId ?? '');
	// svelte-ignore state_referenced_locally
	let pov = $state(data.refs.find((r) => r.role === 'pov')?.elementId ?? '');
	// svelte-ignore state_referenced_locally
	let location = $state(data.refs.find((r) => r.role === 'location')?.elementId ?? '');
	// svelte-ignore state_referenced_locally
	let cast = $state(
		data.refs
			.filter((r) => r.role === 'cast')
			.map((r) => ({ elementId: r.elementId, note: r.note }))
	);
	// svelte-ignore state_referenced_locally
	let startWords = $state(countWords(data.chapter.body));
	let loadedFor = $state('');

	let editor: MarkdownEditor | undefined = $state();
	let saveState: 'clean' | 'dirty' | 'saving' | 'saved' | 'error' = $state('clean');
	let savedAt: Date | null = $state(null);
	let kept = $state(false);
	let timer: ReturnType<typeof setTimeout> | undefined;
	let showBinder = $state(true);
	let showRefs = $state(true);
	let focus = $state(false);
	let confirmDelete = $state(false);
	let newManuscript = $state(false);

	const words = $derived(countWords(body));
	const session = $derived(words - startWords);
	const snapshot = () =>
		JSON.stringify({
			title,
			synopsis,
			body,
			status,
			eventId,
			refs: [
				...(pov ? [{ elementId: pov, role: 'pov' }] : []),
				...(location ? [{ elementId: location, role: 'location' }] : []),
				...cast.map((c) => ({ elementId: c.elementId, role: 'cast', note: c.note }))
			]
		});
	let lastSaved = $state('');

	$effect(() => {
		// Seed local state when navigating between chapters (not on every data refresh).
		if (loadedFor === data.chapter.id) return;
		loadedFor = data.chapter.id;
		title = data.chapter.title;
		synopsis = data.chapter.synopsis;
		body = data.chapter.body;
		status = data.chapter.status;
		eventId = data.chapter.eventId ?? '';
		pov = data.refs.find((r) => r.role === 'pov')?.elementId ?? '';
		location = data.refs.find((r) => r.role === 'location')?.elementId ?? '';
		cast = data.refs
			.filter((r) => r.role === 'cast')
			.map((r) => ({ elementId: r.elementId, note: r.note }));
		startWords = countWords(data.chapter.body);
		lastSaved = snapshot();
		saveState = 'clean';
		confirmDelete = false;
	});

	// Autosave: debounce 1.5s after the last change.
	$effect(() => {
		const current = snapshot();
		if (current === lastSaved) return;
		saveState = 'dirty';
		clearTimeout(timer);
		kept = false;
		timer = setTimeout(() => void save(), 1500);
		return () => clearTimeout(timer);
	});

	async function save(opts: { keep?: boolean } = {}) {
		const current = snapshot();
		if (!title.trim()) return;
		// A deliberate keep is sent even when nothing changed: pausing, then deciding to keep
		// the version you are looking at, is the whole point of the button.
		if (!opts.keep && current === lastSaved) return;
		saveState = 'saving';
		try {
			const r = await fetch(api, {
				method: 'PUT',
				headers: { 'content-type': 'application/json' },
				body: opts.keep ? JSON.stringify({ ...JSON.parse(current), keep: true }) : current
			});
			if (!r.ok) throw new Error(String(r.status));
			const j = (await r.json()) as { savedAt: number };
			lastSaved = current;
			savedAt = new Date(j.savedAt);
			saveState = snapshot() === current ? 'saved' : 'dirty';
			if (opts.keep) kept = true;
		} catch {
			saveState = 'error';
		}
	}

	function onKeydown(e: KeyboardEvent) {
		if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
			e.preventDefault();
			clearTimeout(timer);
			void save();
		}
	}
	function beforeUnload(e: BeforeUnloadEvent) {
		if (saveState === 'dirty' || saveState === 'saving') e.preventDefault();
	}
	async function open(id: string) {
		clearTimeout(timer);
		await save();
		await goto(`${base}/write/${id}`);
	}
	const statusColor: Record<string, string> = {
		draft: 'text-slate-400',
		revised: 'text-sky-300',
		final: 'text-emerald-300'
	};
</script>

<svelte:window onkeydown={onKeydown} onbeforeunload={beforeUnload} />
<svelte:head><title>{title || 'Untitled'} · {data.chapter.manuscriptTitle}</title></svelte:head>

<div class="-mx-4 -mt-14 flex min-h-screen md:-mx-10 md:-mt-8" data-role="workspace">
	<!-- Binder -->
	{#if showBinder && !focus}
		<aside
			class="hidden w-64 shrink-0 flex-col border-r border-slate-800 bg-slate-950/60 lg:flex"
			data-role="binder"
		>
			<div class="flex items-center justify-between border-b border-slate-800 px-3 py-2">
				<span class="text-xs font-semibold tracking-wide text-slate-400 uppercase">Binder</span>
				<button
					type="button"
					class="btn btn-ghost btn-sm"
					title="Hide binder"
					onclick={() => (showBinder = false)}>«</button
				>
			</div>
			<div class="flex-1 overflow-y-auto px-2 py-2 text-sm">
				{#each data.binder as m (m.id)}
					<div class="mb-3">
						<div class="flex items-center justify-between px-1">
							<a
								href="{base}/m/{m.id}"
								class="truncate font-semibold text-slate-200 hover:text-amber-300"
								title="Manuscript overview">📖 {m.title}</a
							>
							<span class="text-[10px] text-slate-600">{m.wordCount.toLocaleString('en')}</span>
						</div>
						<ol class="mt-1">
							{#each m.chapters as c, i (c.id)}
								<li>
									<button
										type="button"
										class="flex w-full items-center gap-2 rounded px-2 py-1 text-left {c.id ===
										data.chapter.id
											? 'bg-slate-800 text-slate-50'
											: 'text-slate-300 hover:bg-slate-900'}"
										onclick={() => open(c.id)}
									>
										<span class="w-4 text-right text-[10px] text-slate-600">{i + 1}</span>
										<span class="min-w-0 flex-1 truncate"
											>{c.id === data.chapter.id ? title || 'Untitled' : c.title}</span
										>
										<span class="text-[10px] {statusColor[c.status] ?? ''}" title={c.status}>●</span
										>
									</button>
								</li>
							{/each}
						</ol>
						<form method="POST" action="?/addChapter" use:enhance class="px-1 pt-1">
							<input type="hidden" name="manuscriptId" value={m.id} />
							<button
								class="w-full rounded px-2 py-1 text-left text-xs text-amber-400 hover:bg-slate-900"
								type="submit">+ New chapter</button
							>
						</form>
					</div>
				{/each}
				{#if newManuscript}
					<form method="POST" action="?/addManuscript" use:enhance class="px-1">
						<input class="input mb-1" name="title" placeholder="Manuscript title" required />
						<div class="flex gap-1">
							<button class="btn btn-primary btn-sm" type="submit">Create</button><button
								class="btn btn-ghost btn-sm"
								type="button"
								onclick={() => (newManuscript = false)}>Cancel</button
							>
						</div>
						{#if form?.error}<p class="text-xs text-red-400">{form.error}</p>{/if}
					</form>
				{:else}
					<button
						type="button"
						class="w-full rounded px-3 py-1 text-left text-xs text-slate-500 hover:bg-slate-900 hover:text-amber-400"
						onclick={() => (newManuscript = true)}>+ New manuscript</button
					>
				{/if}
			</div>
		</aside>
	{/if}

	<!-- Editor -->
	<div class="min-w-0 flex-1 px-4 pt-14 pb-24 md:px-8 md:pt-6">
		<div class="mx-auto {focus ? 'max-w-2xl' : 'max-w-3xl'}">
			<div class="mb-4 flex flex-wrap items-center gap-2 text-xs text-slate-500">
				{#if !showBinder && !focus}<button
						type="button"
						class="btn btn-ghost btn-sm"
						onclick={() => (showBinder = true)}
						title="Show binder">»</button
					>{/if}
				<a href="{base}/m/{data.chapter.manuscriptId}" class="hover:text-slate-300"
					>{data.chapter.manuscriptTitle}</a
				>
				<span class="mx-1">·</span>
				<select
					class="select w-auto border-0 bg-transparent py-0 pr-6 pl-0 text-xs {statusColor[
						status
					] ?? ''} focus:ring-0"
					name="status"
					bind:value={status}
				>
					{#each CHAPTER_STATUSES as st (st)}<option value={st}>{st}</option>{/each}
				</select>
				<span class="ml-auto" data-role="save-state" data-state={saveState}>
					{#if saveState === 'saving'}Saving…
					{:else if saveState === 'dirty'}Unsaved changes
					{:else if saveState === 'error'}<span class="text-red-400"
							>Save failed. Ctrl+S to retry.</span
						>
					{:else if savedAt}Saved {savedAt.toLocaleTimeString()}
					{:else}All changes saved{/if}
				</span>
				<span
					>{words.toLocaleString('en')} words{#if session !== 0}
						· <span class={session > 0 ? 'text-emerald-400' : 'text-red-400'}
							>{session > 0 ? '+' : ''}{session.toLocaleString('en')} this session</span
						>{/if}</span
				>
				<button
					type="button"
					class="btn btn-ghost btn-sm"
					onclick={() => (focus = !focus)}
					title="Focus mode">{focus ? 'Exit focus' : 'Focus'}</button
				>
				{#if !focus}<button
						type="button"
						class="btn btn-ghost btn-sm"
						onclick={() => (showRefs = !showRefs)}
						title="Reference panel">{showRefs ? 'Hide refs' : 'Refs'}</button
					>{/if}
			</div>

			<input
				class="w-full border-0 bg-transparent px-0 font-serif text-3xl font-bold text-slate-50 placeholder-slate-700 focus:ring-0"
				name="title"
				placeholder="Chapter title"
				bind:value={title}
			/>
			{#if !focus}
				<input
					class="mt-1 mb-4 w-full border-0 bg-transparent px-0 text-sm text-slate-400 placeholder-slate-700 focus:ring-0"
					name="synopsis"
					placeholder="Synopsis: what happens in this chapter"
					bind:value={synopsis}
				/>
			{/if}

			<MarkdownEditor
				bind:this={editor}
				name="body"
				bind:value={body}
				index={data.index}
				elementBase="{base}/e/"
				rows={12}
				prose
				autogrow
				showCount={false}
				placeholder="Begin the chapter… Markdown works, and [[Name]] links to your world."
			/>

			{#if !focus}
				<div
					class="mt-10 flex items-center justify-between border-t border-slate-800 pt-4 text-xs text-slate-500"
				>
					<span class="flex gap-3">
						<a
							href="{base}/m/{data.chapter.manuscriptId}/read#ch-{data.chapter.id}"
							class="hover:text-amber-300">Read through →</a
						>
						<a href="{base}/write/{data.chapter.id}/history" class="hover:text-amber-300">History</a
						>
						<button
							type="button"
							class="hover:text-amber-300"
							onclick={() => void save({ keep: true })}>Keep this version</button
						>
						{#if kept}<span class="text-emerald-400">kept ✓</span>{/if}
					</span>
					<span class="flex items-center gap-2">
						<form method="POST" action="?/move" use:enhance class="flex gap-0.5">
							<button class="btn btn-ghost btn-sm" name="dir" value="up" title="Move chapter up"
								>↑</button
							>
							<button class="btn btn-ghost btn-sm" name="dir" value="down" title="Move chapter down"
								>↓</button
							>
						</form>
						{#if confirmDelete}
							<form method="POST" action="?/delete" use:enhance>
								<button class="btn btn-danger btn-sm" type="submit">Really delete chapter</button>
							</form>
							<button
								class="btn btn-ghost btn-sm"
								type="button"
								onclick={() => (confirmDelete = false)}>Cancel</button
							>
						{:else}
							<button
								class="btn btn-ghost btn-sm"
								type="button"
								onclick={() => (confirmDelete = true)}>Delete chapter</button
							>
						{/if}
					</span>
				</div>
			{/if}
		</div>
	</div>

	<!-- References -->
	{#if showRefs && !focus}
		<aside
			class="hidden w-80 shrink-0 overflow-y-auto border-l border-slate-800 bg-slate-950/60 px-4 py-4 xl:block"
			data-role="chapter-refs"
		>
			<ChapterReferences
				{base}
				index={data.index}
				events={data.events}
				{body}
				bind:pov
				bind:location
				bind:eventId
				bind:cast
				oninsert={(t) => editor?.insertAtCursor(t)}
			/>
		</aside>
	{/if}
</div>
