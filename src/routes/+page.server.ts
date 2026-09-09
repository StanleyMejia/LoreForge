import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { createWorld, getWorldBySlug, listWorlds } from '$lib/server/repo/worlds';
import { claimWorld, listWorldsFor } from '$lib/server/repo/members';
import { authConfig } from '$lib/server/auth/config';
import { str } from '$lib/server/form';

export const load: PageServerLoad = ({ locals }) => {
	if (authConfig.enabled && locals.user) {
		const { owned, shared, unclaimed } = listWorldsFor(locals.user.id);
		return { owned, shared, unclaimed, open: false };
	}
	return {
		owned: listWorlds().map((w) => ({ ...w, role: 'owner' as const })),
		shared: [],
		unclaimed: [],
		open: true
	};
};

export const actions: Actions = {
	create: async ({ request, locals }) => {
		const form = await request.formData();
		const name = str(form, 'name').trim();
		if (!name) return fail(400, { error: 'A world needs a name.' });
		const world = createWorld(name, str(form, 'description').trim(), locals.user ?? undefined);
		redirect(303, `/w/${world.slug}`);
	},
	claim: async ({ request, locals }) => {
		if (!authConfig.enabled || !locals.user) error(403);
		const form = await request.formData();
		const world = getWorldBySlug(str(form, 'slug'));
		if (!world) error(404);
		if (!claimWorld(world.id, locals.user.id, locals.user.email))
			return fail(409, { error: 'That world already has an owner.' });
		redirect(303, `/w/${world.slug}`);
	}
};
