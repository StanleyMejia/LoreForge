<script lang="ts">
	interface Props {
		user: { name: string; email: string; picture: string } | null;
		authEnabled: boolean;
		compact?: boolean;
	}
	let { user, authEnabled, compact = false }: Props = $props();
</script>

{#if authEnabled && user}
	<div class="flex items-center gap-2 {compact ? 'text-xs' : 'text-sm'}">
		{#if user.picture}
			<img
				src={user.picture}
				alt=""
				class="h-6 w-6 rounded-full object-cover"
				referrerpolicy="no-referrer"
			/>
		{:else}
			<span
				class="flex h-6 w-6 items-center justify-center rounded-full bg-amber-600/30 text-[11px] font-bold text-amber-200"
				>{(user.name || user.email || '?').slice(0, 1).toUpperCase()}</span
			>
		{/if}
		<span class="min-w-0 truncate text-slate-300" title={user.email}>{user.name || user.email}</span
		>
		<form method="POST" action="/auth/logout" class="ml-auto">
			<button class="btn btn-ghost btn-sm" type="submit" title="Sign out">Sign out</button>
		</form>
	</div>
{/if}
