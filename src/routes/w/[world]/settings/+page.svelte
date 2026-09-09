<script lang="ts">
	import { enhance } from '$app/forms';
	import TypeEditor from '$lib/components/TypeEditor.svelte';

	let { data, form } = $props();
	const base = $derived(`/w/${data.world.slug}`);
	const counts = $derived(new Map(data.types.map((t) => [t.id, t.count])));
	const typeKeys = $derived(data.fullTypes.map((t) => ({ key: t.key, name: t.name })));
</script>

<svelte:head><title>Settings · {data.world.name}</title></svelte:head>

<h1 class="mb-6 text-2xl font-bold text-slate-50">⚙️ World settings</h1>

<div class="max-w-4xl space-y-10">
	<section>
		<h2 class="mb-3 text-sm font-semibold tracking-wide text-slate-400 uppercase">Details</h2>
		<form method="POST" action="?/world" use:enhance class="card space-y-3">
			<div>
				<label class="label" for="name">Name</label><input
					class="input"
					id="name"
					name="name"
					value={data.world.name}
					required
				/>
			</div>
			<div>
				<label class="label" for="description">Description</label><textarea
					class="textarea min-h-16"
					id="description"
					name="description">{data.world.description}</textarea
				>
			</div>
			{#if form?.error}<p class="text-sm text-red-400">{form.error}</p>{/if}
			<button class="btn btn-primary" type="submit">Save</button>
		</form>
	</section>

	<section>
		<h2 class="mb-3 text-sm font-semibold tracking-wide text-slate-400 uppercase">Element types</h2>
		<p class="muted mb-3">
			Each type has its own set of fields. Add types for anything your world needs: religions,
			ships, spells, languages.
		</p>
		<div class="space-y-3">
			{#each data.fullTypes as t, i (t.id)}
				<TypeEditor
					type={t}
					count={counts.get(t.id) ?? 0}
					{typeKeys}
					first={i === 0}
					last={i === data.fullTypes.length - 1}
				/>
			{/each}
		</div>
		<form
			method="POST"
			action="?/addType"
			use:enhance
			class="card mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_100px_100px_auto] sm:items-end"
		>
			<div>
				<label class="label" for="new-name">Plural name</label><input
					class="input"
					id="new-name"
					name="name"
					placeholder="Religions"
					required
				/>
			</div>
			<div>
				<label class="label" for="new-singular">Singular</label><input
					class="input"
					id="new-singular"
					name="singular"
					placeholder="Religion"
				/>
			</div>
			<div>
				<label class="label" for="new-icon">Icon</label><input
					class="input"
					id="new-icon"
					name="icon"
					placeholder="🕯️"
					list="icons"
				/>
			</div>
			<div>
				<label class="label" for="new-color">Colour</label><input
					class="input h-9 p-1"
					id="new-color"
					name="color"
					type="color"
					value="#84cc16"
					list="colors"
				/>
			</div>
			<button class="btn btn-primary" type="submit">+ Add type</button>
			{#if form?.typeError}<p class="text-sm text-red-400 sm:col-span-5">{form.typeError}</p>{/if}
		</form>
	</section>

	<section>
		<h2 class="mb-3 text-sm font-semibold tracking-wide text-slate-400 uppercase">Backup</h2>
		<div class="card flex items-center justify-between gap-4">
			<p class="muted">Download everything in this world as a single JSON file.</p>
			<a class="btn" href="{base}/export" data-sveltekit-reload>Export JSON</a>
		</div>
	</section>

	{#if data.sharing}
		<section data-role="sharing">
			<h2 class="mb-3 text-sm font-semibold tracking-wide text-slate-400 uppercase">Sharing</h2>
			<div class="card space-y-5">
				<div>
					<h3 class="mb-2 font-semibold">People</h3>
					<ul class="divide-y divide-slate-800">
						{#each data.sharing.members as m (m.id)}
							<li class="flex flex-wrap items-center gap-3 py-2 text-sm">
								<div class="min-w-0 flex-1">
									<div class="truncate text-slate-100">
										{m.name || m.email}{#if m.isSelf}<span class="muted"> (you)</span>{/if}
									</div>
									<div class="truncate text-xs text-slate-500">
										{m.email}{#if m.pending}
											· <span class="text-amber-400">invited, not signed in yet</span>{/if}
									</div>
								</div>
								{#if m.role === 'owner'}
									<span class="chip">Owner</span>
								{:else}
									<form
										method="POST"
										action="?/setRole"
										use:enhance
										class="flex items-center gap-2"
									>
										<input type="hidden" name="id" value={m.id} />
										<select
											class="select w-auto py-1 text-xs"
											name="role"
											onchange={(e) => e.currentTarget.form?.requestSubmit()}
										>
											<option value="editor" selected={m.role === 'editor'}>Editor</option>
											<option value="viewer" selected={m.role === 'viewer'}>Viewer</option>
										</select>
									</form>
									<form method="POST" action="?/removeMember" use:enhance>
										<input type="hidden" name="id" value={m.id} />
										<button
											class="btn btn-ghost btn-sm text-red-300"
											type="submit"
											title="Remove access">✕</button
										>
									</form>
								{/if}
							</li>
						{/each}
					</ul>
					<form
						method="POST"
						action="?/share"
						use:enhance
						class="mt-3 grid gap-2 sm:grid-cols-[1fr_140px_auto]"
					>
						<input
							class="input"
							name="email"
							type="email"
							placeholder="person@example.lan"
							required
						/>
						<select class="select" name="role"
							><option value="editor">Editor</option><option value="viewer" selected>Viewer</option
							></select
						>
						<button class="btn btn-primary" type="submit">Share</button>
						{#if form?.shareError}<p class="text-sm text-red-400 sm:col-span-3">
								{form.shareError}
							</p>{/if}
					</form>
					<p class="muted mt-2 text-xs">
						Editors can change everything except sharing and deleting the world. Viewers can read
						and export. People who haven't signed in yet get access on their first login with that
						email.
					</p>
				</div>

				<div>
					<h3 class="mb-2 font-semibold">Invite links</h3>
					{#if data.sharing.invites.length}
						<ul class="mb-3 space-y-2">
							{#each data.sharing.invites as inv (inv.id)}
								<li class="flex flex-wrap items-center gap-2 text-sm">
									<span class="chip capitalize">{inv.role}</span>
									<input
										class="input flex-1 py-1 font-mono text-xs"
										readonly
										value="{data.sharing.origin}/invite/{inv.id}"
										onfocus={(e) => e.currentTarget.select()}
									/>
									<span class="text-xs text-slate-500"
										>expires {new Date(inv.expiresAt).toLocaleDateString()} · used {inv.uses}×</span
									>
									<form method="POST" action="?/revokeInvite" use:enhance>
										<input type="hidden" name="id" value={inv.id} />
										<button class="btn btn-ghost btn-sm text-red-300" type="submit">Revoke</button>
									</form>
								</li>
							{/each}
						</ul>
					{/if}
					<form
						method="POST"
						action="?/createInvite"
						use:enhance
						class="flex flex-wrap items-center gap-2"
					>
						<select class="select w-auto" name="role"
							><option value="viewer">Viewer</option><option value="editor">Editor</option></select
						>
						<label class="muted text-xs" for="inv-days">valid for</label>
						<input
							class="input w-20"
							id="inv-days"
							name="days"
							type="number"
							min="1"
							max="90"
							value="7"
						/>
						<span class="muted text-xs">days</span>
						<button class="btn" type="submit">Create link</button>
					</form>
				</div>
			</div>
		</section>
	{:else if data.authEnabled && !data.owner}
		<section>
			<h2 class="mb-3 text-sm font-semibold tracking-wide text-slate-400 uppercase">Sharing</h2>
			<div class="card"><p class="muted">Only the world's owner can manage who has access.</p></div>
		</section>
	{/if}

	{#if data.owner}
		<section>
			<h2 class="mb-3 text-sm font-semibold tracking-wide text-red-400 uppercase">Danger zone</h2>
			<form
				method="POST"
				action="?/deleteWorld"
				use:enhance
				class="card space-y-3 border-red-900/60"
			>
				<p class="muted">
					Deleting a world removes all of its elements, events and manuscripts. Export first.
				</p>
				<div>
					<label class="label" for="confirm"
						>Type <span class="text-slate-200">{data.world.name}</span> to confirm</label
					><input class="input" id="confirm" name="confirm" autocomplete="off" />
				</div>
				{#if form?.deleteError}<p class="text-sm text-red-400">{form.deleteError}</p>{/if}
				<button class="btn btn-danger" type="submit">Delete world</button>
			</form>
		</section>
	{/if}
</div>
