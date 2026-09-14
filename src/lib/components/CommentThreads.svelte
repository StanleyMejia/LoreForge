<script lang="ts">
	import { enhance } from '$app/forms';
	import { timeAgo } from '$lib/format';
	import { threads, type CommentView } from '$lib/comments';

	let {
		comments,
		hidden = {},
		readonly = false,
		placeholder = 'Leave a note…',
		role = 'comments'
	}: {
		/** Comments on one target — a panel or a chapter — oldest first. */
		comments: CommentView[];
		/** Extra fields a new thread needs, such as the panel it is on. */
		hidden?: Record<string, string>;
		readonly?: boolean;
		placeholder?: string;
		role?: string;
	} = $props();

	const list = $derived(threads(comments));
	const open = $derived(list.filter((t) => !t.root.resolvedAt).length);
</script>

<details class="mt-4 border-t border-slate-800 pt-3" data-role={role}>
	<summary class="muted cursor-pointer text-xs hover:text-slate-300">
		💬 {list.length === 0 ? 'Comment' : `${list.length} thread${list.length === 1 ? '' : 's'}`}{open
			? ` · ${open} open`
			: ''}
	</summary>

	<ul class="mt-3 space-y-4">
		{#each list as t (t.root.id)}
			<li class="text-xs {t.root.resolvedAt ? 'opacity-50' : ''}" data-role="comment-thread">
				{@render comment(t.root, true)}
				{#if t.replies.length}
					<ul class="mt-2 space-y-2 border-l border-slate-800 pl-3">
						{#each t.replies as c (c.id)}
							<li data-role="comment-reply">{@render comment(c, false)}</li>
						{/each}
					</ul>
				{/if}
				{#if !readonly && !t.root.resolvedAt}
					<form method="POST" action="?/comment" use:enhance class="mt-2 flex gap-2 pl-3">
						<input type="hidden" name="parentId" value={t.root.id} />
						<input class="input text-xs" name="body" placeholder="Reply…" required />
						<button class="btn btn-ghost btn-sm" type="submit">Reply</button>
					</form>
				{/if}
			</li>
		{/each}
	</ul>

	{#if !readonly}
		<form method="POST" action="?/comment" use:enhance class="mt-3 flex gap-2">
			{#each Object.entries(hidden) as [name, value] (name)}
				<input type="hidden" {name} {value} />
			{/each}
			<input class="input text-xs" name="body" {placeholder} required />
			<button class="btn btn-sm" type="submit">Post</button>
		</form>
	{/if}
</details>

{#snippet comment(c: CommentView, root: boolean)}
	<div data-role="comment">
		<p class="whitespace-pre-wrap text-slate-300">{c.body}</p>
		<div class="muted mt-1 flex flex-wrap items-center gap-2">
			<span>{c.author ?? 'Someone'} · {timeAgo(c.createdAt)}</span>
			{#if root && c.resolvedAt}<span class="chip">resolved</span>{/if}
			{#if !readonly}
				{#if root}
					<form method="POST" action="?/resolveComment" use:enhance>
						<input type="hidden" name="id" value={c.id} />
						<input type="hidden" name="resolved" value={c.resolvedAt ? 'false' : 'true'} />
						<button class="hover:text-amber-300" type="submit"
							>{c.resolvedAt ? 'Reopen' : 'Resolve'}</button
						>
					</form>
				{/if}
				<form method="POST" action="?/deleteComment" use:enhance>
					<input type="hidden" name="id" value={c.id} />
					<button
						class="hover:text-red-400"
						type="submit"
						title={root ? 'Deletes the whole thread' : 'Delete this reply'}>Delete</button
					>
				</form>
			{/if}
		</div>
	</div>
{/snippet}
