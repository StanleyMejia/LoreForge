<script lang="ts">
	import { enhance } from '$app/forms';
	import MarkdownEditor from '$lib/components/MarkdownEditor.svelte';
	import ChapterReferences from '$lib/components/ChapterReferences.svelte';
	import { CHAPTER_STATUSES } from '$lib/types';
	import { timeAgo } from '$lib/format';

	let { data, form } = $props();
	const base = $derived(`/w/${data.world.slug}`);
	const mbase = $derived(`${base}/m/${data.manuscript.id}`);

	// svelte-ignore state_referenced_locally
	let body = $state(data.chapter.body);
	// svelte-ignore state_referenced_locally
	let title = $state(data.chapter.title);
	// svelte-ignore state_referenced_locally
	let synopsis = $state(data.chapter.synopsis);
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
	let dirty = $state(false);
	let confirmDelete = $state(false);
	let focus = $state(false);
	let showRefs = $state(true);
	let editor: MarkdownEditor | undefined = $state();

	const refsJson = $derived(
		JSON.stringify([
			...(pov ? [{ elementId: pov, role: 'pov' }] : []),
			...(location ? [{ elementId: location, role: 'location' }] : []),
			...cast.map((c) => ({ elementId: c.elementId, role: 'cast', note: c.note }))
		])
	);

	$effect(() => {
		body = data.chapter.body;
		title = data.chapter.title;
		synopsis = data.chapter.synopsis;
		status = data.chapter.status;
		eventId = data.chapter.eventId ?? '';
		pov = data.refs.find((r) => r.role === 'pov')?.elementId ?? '';
		location = data.refs.find((r) => r.role === 'location')?.elementId ?? '';
		cast = data.refs
			.filter((r) => r.role === 'cast')
			.map((r) => ({ elementId: r.elementId, note: r.note }));
		dirty = false;
	});

	let formEl: HTMLFormElement | undefined = $state();
	function beforeUnload(e: BeforeUnloadEvent) {
		if (dirty) e.preventDefault();
	}
	/** Ctrl+S saves from anywhere on the page, not only inside the text editor. */
	function onKeydown(e: KeyboardEvent) {
		if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's' && !e.defaultPrevented) {
			e.preventDefault();
			formEl?.requestSubmit();
		}
	}
	function insert(text: string) {
		editor?.insertAtCursor(text);
		dirty = true;
	}
</script>

<svelte:window onbeforeunload={beforeUnload} onkeydown={onKeydown} />
<svelte:head><title>{data.chapter.title} · {data.manuscript.title}</title></svelte:head>

<div class="mx-auto {focus ? 'max-w-3xl' : 'max-w-7xl'}">
	{#if !focus}
		<nav class="mb-4 flex items-center justify-between text-xs text-slate-500">
			<div>
				<a href="{base}/manuscripts" class="hover:text-slate-300">📖 Manuscripts</a>
				<span class="mx-1">/</span>
				<a href={mbase} class="hover:text-slate-300">{data.manuscript.title}</a>
				<span class="mx-1">/</span>
				<span class="text-slate-300">Chapter {data.nav.index + 1} of {data.nav.total}</span>
			</div>
			<div class="flex gap-3">
				{#if data.nav.prev}<a class="hover:text-slate-300" href="{mbase}/c/{data.nav.prev.id}"
						>← {data.nav.prev.title}</a
					>{/if}
				{#if data.nav.next}<a class="hover:text-slate-300" href="{mbase}/c/{data.nav.next.id}"
						>{data.nav.next.title} →</a
					>{/if}
			</div>
		</nav>
	{/if}

	<form
		method="POST"
		action="?/save"
		bind:this={formEl}
		use:enhance={() =>
			async ({ update }) => {
				await update({ reset: false });
				dirty = false;
			}}
		oninput={() => (dirty = true)}
	>
		<input type="hidden" name="refs" value={refsJson} />
		<div class="grid gap-6 {focus || !showRefs ? '' : 'lg:grid-cols-[1fr_320px]'}">
			<div class="min-w-0 space-y-4">
				<div class="flex flex-wrap items-end gap-3">
					<div class="min-w-64 flex-1">
						<label class="label" for="title">Title</label>
						<input
							class="input text-xl font-semibold"
							id="title"
							name="title"
							bind:value={title}
							required
						/>
					</div>
					<div>
						<label class="label" for="status">Status</label>
						<select class="select" id="status" name="status" bind:value={status}>
							{#each CHAPTER_STATUSES as s (s)}<option value={s}>{s}</option>{/each}
						</select>
					</div>
					{#if !focus}
						<button
							class="btn btn-ghost"
							type="button"
							onclick={() => (showRefs = !showRefs)}
							title="Toggle reference panel">{showRefs ? 'Hide refs' : 'Refs'}</button
						>
					{/if}
					<button
						class="btn btn-ghost"
						type="button"
						onclick={() => (focus = !focus)}
						title="Toggle focus mode">{focus ? 'Exit focus' : 'Focus'}</button
					>
					<button class="btn btn-primary" type="submit">{dirty ? 'Save *' : 'Save'}</button>
				</div>

				{#if !focus}
					<div>
						<label class="label" for="synopsis">Synopsis</label>
						<input
							class="input"
							id="synopsis"
							name="synopsis"
							bind:value={synopsis}
							placeholder="What happens in this chapter"
						/>
					</div>
				{/if}

				<MarkdownEditor
					bind:this={editor}
					name="body"
					bind:value={body}
					index={data.index}
					elementBase="{base}/e/"
					rows={focus ? 32 : 24}
					serif
				/>

				<div class="flex items-center justify-between text-xs text-slate-500">
					<span>
						{#if form?.error}<span class="text-red-400">{form.error}</span>
						{:else if form?.saved}Saved {timeAgo(form.saved)}
						{:else}Last saved {timeAgo(data.chapter.updatedAt)}{/if}
					</span>
					{#if !focus}
						{#if confirmDelete}
							<span class="flex gap-2">
								<button
									class="btn btn-danger btn-sm"
									type="submit"
									formaction="?/delete"
									formnovalidate>Really delete chapter</button
								>
								<button
									class="btn btn-ghost btn-sm"
									type="button"
									onclick={() => (confirmDelete = false)}>Cancel</button
								>
							</span>
						{:else}
							<button
								class="btn btn-ghost btn-sm"
								type="button"
								onclick={() => (confirmDelete = true)}>Delete chapter</button
							>
						{/if}
					{/if}
				</div>
			</div>

			{#if !focus && showRefs}
				<aside
					class="card self-start lg:sticky lg:top-8 lg:max-h-[calc(100vh-4rem)] lg:overflow-y-auto"
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
						oninsert={insert}
					/>
				</aside>
			{/if}
		</div>
	</form>
</div>
