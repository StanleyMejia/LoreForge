<script lang="ts">
	import { enhance } from '$app/forms';
	import MarkdownEditor from '$lib/components/MarkdownEditor.svelte';
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
	let dirty = $state(false);
	let confirmDelete = $state(false);
	let focus = $state(false);

	$effect(() => {
		body = data.chapter.body;
		title = data.chapter.title;
		synopsis = data.chapter.synopsis;
		status = data.chapter.status;
		dirty = false;
	});

	function beforeUnload(e: BeforeUnloadEvent) {
		if (dirty) e.preventDefault();
	}
</script>

<svelte:window onbeforeunload={beforeUnload} />
<svelte:head><title>{data.chapter.title} · {data.manuscript.title}</title></svelte:head>

<div class="mx-auto {focus ? 'max-w-3xl' : 'max-w-5xl'}">
	{#if !focus}
		<nav class="mb-4 flex items-center justify-between text-xs text-slate-500">
			<div>
				<a href="{base}/manuscripts" class="hover:text-slate-300">📖 Manuscripts</a>
				<span class="mx-1">/</span>
				<a href={mbase} class="hover:text-slate-300">{data.manuscript.title}</a>
				<span class="mx-1">/</span>
				<span class="text-slate-300">Chapter {data.nav.index + 1} of {data.nav.total}</span>
			</div>
			<div class="flex gap-2">
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
		use:enhance={() =>
			async ({ update }) => {
				await update({ reset: false });
				dirty = false;
			}}
		oninput={() => (dirty = true)}
		class="space-y-4"
	>
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
						<button class="btn btn-danger btn-sm" type="submit" formaction="?/delete" formnovalidate
							>Really delete chapter</button
						>
						<button
							class="btn btn-ghost btn-sm"
							type="button"
							onclick={() => (confirmDelete = false)}>Cancel</button
						>
					</span>
				{:else}
					<button class="btn btn-ghost btn-sm" type="button" onclick={() => (confirmDelete = true)}
						>Delete chapter</button
					>
				{/if}
			{/if}
		</div>
	</form>
</div>
