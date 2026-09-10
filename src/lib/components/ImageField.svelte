<script lang="ts">
	/**
	 * An image URL input with an "Upload" button that stores the file on the server and fills
	 * the field with the served URL. Plain URLs keep working.
	 */
	interface Props {
		value: string;
		base: string; // world base, e.g. /w/my-world
		name?: string;
		id?: string;
		placeholder?: string;
		compact?: boolean;
	}
	let {
		value = $bindable(''),
		base,
		name,
		id,
		placeholder = 'https://… or upload',
		compact = false
	}: Props = $props();

	let input: HTMLInputElement | undefined = $state();
	let busy = $state(false);
	let err = $state('');

	async function upload(file: File) {
		busy = true;
		err = '';
		try {
			const fd = new FormData();
			fd.append('file', file);
			const r = await fetch(`${base}/api/uploads`, { method: 'POST', body: fd });
			if (!r.ok) {
				const t = await r.text();
				throw new Error(
					/<\/?[a-z]/i.test(t)
						? `Upload failed (${r.status})`
						: t.slice(0, 200) || `Upload failed (${r.status})`
				);
			}
			const j = (await r.json()) as { url: string };
			value = j.url;
		} catch (e) {
			err =
				e instanceof Error
					? e.message.replace(/^\{.*"message":"([^"]+)".*\}$/, '$1')
					: 'Upload failed';
		} finally {
			busy = false;
			if (input) input.value = '';
		}
	}
</script>

<div class="flex items-center gap-2" data-role="image-field">
	{#if value}
		<img
			src={value}
			alt=""
			class="{compact ? 'h-9 w-9' : 'h-12 w-12'} shrink-0 rounded object-cover"
		/>
	{/if}
	<input class="input min-w-0 flex-1" {id} {name} {placeholder} bind:value />
	<input
		bind:this={input}
		type="file"
		accept="image/png,image/jpeg,image/gif,image/webp"
		class="hidden"
		onchange={(e) => {
			const f = e.currentTarget.files?.[0];
			if (f) void upload(f);
		}}
	/>
	<button
		type="button"
		class="btn btn-sm shrink-0"
		disabled={busy}
		onclick={() => input?.click()}
		title="Upload an image (PNG, JPEG, GIF, WebP)">{busy ? 'Uploading…' : 'Upload'}</button
	>
	{#if value}<button
			type="button"
			class="btn btn-ghost btn-sm shrink-0"
			title="Clear"
			onclick={() => (value = '')}>✕</button
		>{/if}
	{#if err}<span class="text-xs text-red-400">{err}</span>{/if}
</div>
