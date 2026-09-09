<script lang="ts">
	import { enhance } from '$app/forms';
	import { timeAgo } from '$lib/format';
	import UserMenu from '$lib/components/UserMenu.svelte';

	let { data, form } = $props();
	const hasAny = $derived(data.owned.length + data.shared.length + data.unclaimed.length > 0);
</script>

<svelte:head><title>Loreforge</title></svelte:head>

{#snippet worldCard(
	w: { slug: string; name: string; description: string; updatedAt: Date; elementCount: number },
	badge?: string
)}
	<a href="/w/{w.slug}" class="card transition hover:border-amber-600/60 hover:bg-slate-900">
		<div class="flex items-start justify-between gap-2">
			<h2 class="text-lg font-semibold text-slate-50">{w.name}</h2>
			{#if badge}<span class="chip shrink-0 capitalize">{badge}</span>{/if}
		</div>
		{#if w.description}<p class="muted mt-1 line-clamp-2">{w.description}</p>{/if}
		<p class="mt-3 text-xs text-slate-500">
			{w.elementCount} element{w.elementCount === 1 ? '' : 's'} · updated {timeAgo(w.updatedAt)}
		</p>
	</a>
{/snippet}

<div class="mx-auto max-w-4xl px-6 py-12">
	<header class="mb-10 flex items-end justify-between gap-4">
		<div>
			<h1 class="text-3xl font-bold tracking-tight text-slate-50">Loreforge</h1>
			<p class="muted mt-1">Self-hosted worldbuilding and manuscript workspace.</p>
		</div>
		<UserMenu user={data.user} authEnabled={data.authEnabled} />
	</header>

	{#if data.owned.length}
		<section class="mb-10" data-role="owned">
			{#if !data.open}<h2 class="mb-3 text-sm font-semibold tracking-wide text-slate-400 uppercase">
					Your worlds
				</h2>{/if}
			<div class="grid gap-4 sm:grid-cols-2">
				{#each data.owned as w (w.id)}{@render worldCard(w)}{/each}
			</div>
		</section>
	{/if}

	{#if data.shared.length}
		<section class="mb-10" data-role="shared">
			<h2 class="mb-3 text-sm font-semibold tracking-wide text-slate-400 uppercase">
				Shared with you
			</h2>
			<div class="grid gap-4 sm:grid-cols-2">
				{#each data.shared as w (w.id)}{@render worldCard(w, w.role)}{/each}
			</div>
		</section>
	{/if}

	{#if data.unclaimed.length}
		<section class="mb-10" data-role="unclaimed">
			<h2 class="mb-1 text-sm font-semibold tracking-wide text-slate-400 uppercase">
				Unclaimed worlds
			</h2>
			<p class="muted mb-3 text-xs">
				Created before sign-in was enabled. Claim one to become its owner.
			</p>
			<div class="grid gap-4 sm:grid-cols-2">
				{#each data.unclaimed as w (w.id)}
					<div class="card flex items-start justify-between gap-3">
						<div class="min-w-0">
							<h3 class="truncate font-semibold text-slate-50">{w.name}</h3>
							<p class="text-xs text-slate-500">
								{w.elementCount} elements · updated {timeAgo(w.updatedAt)}
							</p>
						</div>
						<form method="POST" action="?/claim" use:enhance>
							<input type="hidden" name="slug" value={w.slug} />
							<button class="btn btn-sm" type="submit">Claim</button>
						</form>
					</div>
				{/each}
			</div>
		</section>
	{/if}

	{#if !hasAny}
		<p class="muted mb-8">No worlds yet. Create your first one below.</p>
	{/if}

	<section class="card max-w-xl">
		<h2 class="mb-3 text-base font-semibold">New world</h2>
		<form method="POST" action="?/create" use:enhance class="space-y-3">
			<div>
				<label class="label" for="name">Name</label>
				<input class="input" id="name" name="name" required placeholder="The Shattered Reach" />
			</div>
			<div>
				<label class="label" for="description">Description</label>
				<textarea
					class="textarea"
					id="description"
					name="description"
					rows="2"
					placeholder="One line about this universe"></textarea>
			</div>
			{#if form?.error}<p class="text-sm text-red-400">{form.error}</p>{/if}
			<button class="btn btn-primary" type="submit">Create world</button>
		</form>
	</section>
</div>
