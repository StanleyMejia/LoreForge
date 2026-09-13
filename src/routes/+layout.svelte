<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import { beforeNavigate } from '$app/navigation';
	import { updated } from '$app/state';

	let { children } = $props();

	// A new version has been deployed, so this tab's hashed chunks are gone. Leave the router out
	// of it and do a real page load, which costs one navigation instead of breaking it.
	beforeNavigate((nav) => {
		if (updated.current && !nav.willUnload && nav.to?.url) {
			nav.cancel();
			location.href = nav.to.url.href;
		}
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>
{@render children()}
