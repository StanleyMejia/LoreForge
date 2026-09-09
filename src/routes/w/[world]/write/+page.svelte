<script lang="ts">
	import { enhance } from '$app/forms';

	let { data } = $props();
</script>

<svelte:head><title>Write · {data.world.name}</title></svelte:head>

<div class="mx-auto max-w-xl py-10">
	<h1 class="font-serif text-3xl font-bold text-slate-50">✍️ Start writing</h1>
	<p class="muted mt-2 mb-6">
		Nothing has been written in {data.world.name} yet. Name your manuscript and the first chapter; you
		can rename both later.
	</p>
	<form method="POST" action="?/start" use:enhance class="card space-y-3">
		<div>
			<label class="label" for="title">Manuscript</label><input
				class="input"
				id="title"
				name="title"
				placeholder="Salt and Silence"
				required
			/>
		</div>
		<div>
			<label class="label" for="chapter">First chapter</label><input
				class="input"
				id="chapter"
				name="chapter"
				placeholder="Chapter 1"
			/>
		</div>
		<button class="btn btn-primary" type="submit">Open the workspace</button>
	</form>
</div>
