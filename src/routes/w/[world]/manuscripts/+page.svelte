<script lang="ts">
	import { enhance } from '$app/forms';
	import { timeAgo } from '$lib/format';

	let { data, form } = $props();
	const base = $derived(`/w/${data.world.slug}`);
</script>

<svelte:head><title>Manuscripts · {data.world.name}</title></svelte:head>

<h1 class="mb-6 text-2xl font-bold text-slate-50">📖 Manuscripts</h1>

<div class="grid gap-8 lg:grid-cols-[2fr_1fr]">
	<section>
		{#if data.manuscripts.length}
			<ul class="space-y-3">
				{#each data.manuscripts as m (m.id)}
					<li>
						<a href="{base}/m/{m.id}" class="card block hover:border-slate-600">
							<h2 class="text-lg font-semibold text-slate-50">{m.title}</h2>
							{#if m.description}<p class="muted mt-1">{m.description}</p>{/if}
							<p class="mt-2 text-xs text-slate-500">
								{m.chapterCount} chapters · {m.wordCount.toLocaleString('en')} words · updated {timeAgo(
									m.updatedAt
								)}
							</p>
						</a>
					</li>
				{/each}
			</ul>
		{:else}
			<div class="card">
				<p class="muted">
					No manuscripts yet. A manuscript is a book, novella, or any long-form piece set in this
					world.
				</p>
			</div>
		{/if}
	</section>

	{#if !data.readonly}
		<form method="POST" action="?/create" use:enhance class="card space-y-3 self-start">
			<h2 class="font-semibold">New manuscript</h2>
			<div>
				<label class="label" for="title">Title</label><input
					class="input"
					id="title"
					name="title"
					required
				/>
			</div>
			<div>
				<label class="label" for="description">Description</label><textarea
					class="textarea min-h-16"
					id="description"
					name="description"
					rows="2"></textarea>
			</div>
			{#if form?.error}<p class="text-sm text-red-400">{form.error}</p>{/if}
			<button class="btn btn-primary" type="submit">Create</button>
		</form>
	{/if}
</div>
