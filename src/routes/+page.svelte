<script lang="ts">
	import { enhance } from '$app/forms';
	import { timeAgo } from '$lib/format';

	let { data, form } = $props();
</script>

<svelte:head><title>Loreforge</title></svelte:head>

<div class="mx-auto max-w-4xl px-6 py-12">
	<header class="mb-10 flex items-end justify-between">
		<div>
			<h1 class="text-3xl font-bold tracking-tight text-slate-50">Loreforge</h1>
			<p class="muted mt-1">Self-hosted worldbuilding and manuscript workspace.</p>
		</div>
	</header>

	{#if data.worlds.length}
		<section class="mb-12 grid gap-4 sm:grid-cols-2">
			{#each data.worlds as w (w.id)}
				<a href="/w/{w.slug}" class="card transition hover:border-amber-600/60 hover:bg-slate-900">
					<h2 class="text-lg font-semibold text-slate-50">{w.name}</h2>
					{#if w.description}
						<p class="muted mt-1 line-clamp-2">{w.description}</p>
					{/if}
					<p class="mt-3 text-xs text-slate-500">
						{w.elementCount} element{w.elementCount === 1 ? '' : 's'} · updated {timeAgo(
							w.updatedAt
						)}
					</p>
				</a>
			{/each}
		</section>
	{:else}
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
