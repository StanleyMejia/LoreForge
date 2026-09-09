<script lang="ts">
	let { data } = $props();
</script>

<svelte:head><title>Sign in · Loreforge</title></svelte:head>

<div class="flex min-h-screen items-center justify-center px-6">
	<div class="card w-full max-w-sm p-8 text-center">
		<h1 class="text-2xl font-bold text-slate-50">Loreforge</h1>
		<p class="muted mt-1 mb-6">Sign in to open your worlds.</p>
		{#if data.error}<p
				class="mb-4 rounded-md border border-red-900 bg-red-950/60 px-3 py-2 text-sm text-red-200"
			>
				{data.error}
			</p>{/if}
		<a
			class="btn btn-primary w-full justify-center py-2.5 text-base"
			href="/auth/login?next={encodeURIComponent(data.next)}"
			data-sveltekit-reload
		>
			Continue with {data.provider}
		</a>
	</div>
</div>
