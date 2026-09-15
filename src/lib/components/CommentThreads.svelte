<script lang="ts">
	import { enhance } from '$app/forms';
	import { timeAgo } from '$lib/format';
	import { threads, type CommentView } from '$lib/comments';

	let {
		comments,
		hidden = {},
		readonly = false,
		editor = true,
		userId = null,
		placeholder = 'Leave a note…',
		role = 'comments'
	}: {
		/** Comments on one target — a panel or a chapter — oldest first. */
		comments: CommentView[];
		/** Extra fields a new thread or reply needs, such as the panel or chapter it is on. */
		hidden?: Record<string, string>;
		/** No forms at all. */
		readonly?: boolean;
		/** Editors resolve threads and delete anyone's comment; viewers only delete their own. */
		editor?: boolean;
		userId?: string | null;
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
				{@render comment(t.root, true, t.replies.length > 0)}
				{#if t.replies.length}
					<ul class="mt-2 space-y-2 border-l border-slate-800 pl-3">
						{#each t.replies as c (c.id)}
							<li data-role="comment-reply">{@render comment(c, false, false)}</li>
						{/each}
					</ul>
				{/if}
				{#if !readonly && !t.root.resolvedAt}
					<form method="POST" action="?/comment" use:enhance class="mt-2 flex gap-2 pl-3">
						{#each Object.entries(hidden) as [name, value] (name)}
							<input type="hidden" {name} {value} />
						{/each}
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

{#snippet comment(c: CommentView, root: boolean, answered: boolean)}
	<div data-role="comment">
		<p class="whitespace-pre-wrap text-slate-300">{c.body}</p>
		<div class="muted mt-1 flex flex-wrap items-center gap-2">
			<span>{c.author ?? 'Someone'} · {timeAgo(c.createdAt)}</span>
			{#if root && c.resolvedAt}<span class="chip">resolved</span>{/if}
			{#if !readonly && (editor || (userId && c.authorId === userId && !answered))}
				{#if root && editor}
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
