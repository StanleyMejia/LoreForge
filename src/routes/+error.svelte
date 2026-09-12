<script lang="ts">
	import { page } from '$app/state';

	/** SvelteKit's own message is often the useful one ("Element not found"), so lead with it. */
	const status = $derived(page.status);
	const detail = $derived(page.error?.message ?? '');
	const generic = $derived(
		status === 404
			? 'That page does not exist, or it was renamed or deleted.'
			: status === 403
				? 'You do not have access to that.'
				: 'Something went wrong on our side.'
	);
</script>

<svelte:head>
	<title>{status} · Loreforge</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<div class="flex min-h-screen items-center justify-center px-6 py-12">
	<div class="card w-full max-w-md p-8 text-center">
		<p class="font-serif text-5xl font-bold text-amber-500">{status}</p>
		<h1 class="mt-3 text-lg font-semibold text-slate-50">
			{detail && detail !== 'Not Found' ? detail : generic}
		</h1>
		{#if detail && detail !== 'Not Found' && status === 404}
			<p class="muted mt-2 text-sm">{generic}</p>
		{/if}

		<div class="mt-6 flex flex-wrap justify-center gap-2">
			<a class="btn btn-primary" href="/">Your worlds</a>
			<button class="btn" type="button" onclick={() => history.back()}>Go back</button>
		</div>

		<p class="muted mt-8 text-xs">
			Loreforge · © {new Date().getFullYear()}
		</p>
	</div>
</div>
