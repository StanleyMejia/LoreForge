import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import {
	createType,
	deleteType,
	getTypeById,
	getWorldBySlug,
	listTypes,
	updateType,
	updateWorld,
	deleteWorld
} from '$lib/server/repo/worlds';
import { parseJson, str } from '$lib/server/form';
import { cleanPanels } from '$lib/server/panels';
import { authConfig } from '$lib/server/auth/config';
import { deleteUpload, listUploads } from '$lib/server/repo/uploads';
import { rebuildIndex } from '$lib/server/repo/search';
import {
	createInvite,
	isRole,
	listInvites,
	listMembers,
	removeMember,
	revokeInvite,
	setMemberRole,
	shareByEmail
} from '$lib/server/repo/members';

export const load: PageServerLoad = async ({ parent, locals }) => {
	const { world, role } = await parent();
	const owner = role === 'owner';
	return {
		fullTypes: listTypes(world.id),
		uploads: listUploads(world.id),
		owner,
		sharing:
			authConfig.enabled && owner && locals.user
				? {
						members: listMembers(world.id, locals.user.id),
						invites: listInvites(world.id),
						origin: authConfig.origin.replace(/\/$/, '')
					}
				: null
	};
};

function requireOwner(locals: App.Locals) {
	if (locals.world?.role !== 'owner') error(403, 'Only the owner can do that');
}

export const actions: Actions = {
	world: async ({ request, locals }) => {
		const world = locals.world!;
		const form = await request.formData();
		const name = str(form, 'name').trim();
		if (!name) return fail(400, { error: 'Name is required.' });
		updateWorld(world.id, { name, description: str(form, 'description').trim() });
		return { ok: true };
	},
	deleteWorld: async ({ params, request, locals }) => {
		requireOwner(locals);
		const world = getWorldBySlug(params.world)!;
		const form = await request.formData();
		if (str(form, 'confirm') !== world.name)
			return fail(400, { deleteError: 'Type the world name exactly to confirm.' });
		deleteWorld(world.id);
		redirect(303, '/');
	},
	addType: async ({ request, locals }) => {
		const world = locals.world!;
		const form = await request.formData();
		const name = str(form, 'name').trim();
		const singular = str(form, 'singular').trim() || name.replace(/s$/i, '');
		if (!name) return fail(400, { typeError: 'Name is required.' });
		createType(world.id, {
			name,
			singular,
			icon: str(form, 'icon').trim() || '📄',
			color: str(form, 'color').trim() || '#94a3b8'
		});
		return { ok: true };
	},
	updateType: async ({ request, locals }) => {
		const world = locals.world!;
		const form = await request.formData();
		const type = getTypeById(str(form, 'id'));
		if (!type || type.worldId !== world.id) error(404);
		const name = str(form, 'name').trim();
		if (!name) return fail(400, { typeError: 'Name is required.' });
		updateType(type.id, {
			name,
			singular: str(form, 'singular').trim() || name,
			icon: str(form, 'icon').trim() || '📄',
			color: str(form, 'color').trim() || '#94a3b8',
			panels: cleanPanels(parseJson(str(form, 'panels'), []), true)
		});
		return { ok: true };
	},
	moveType: async ({ request, locals }) => {
		const world = locals.world!;
		const form = await request.formData();
		const id = str(form, 'id');
		const dir = str(form, 'dir');
		const list = listTypes(world.id);
		const i = list.findIndex((t) => t.id === id);
		const j = dir === 'up' ? i - 1 : i + 1;
		if (i < 0 || j < 0 || j >= list.length) return { ok: true };
		[list[i], list[j]] = [list[j], list[i]];
		list.forEach((t, idx) => updateType(t.id, { sortOrder: idx }));
		return { ok: true };
	},
	deleteType: async ({ request, locals }) => {
		const world = locals.world!;
		const form = await request.formData();
		const type = getTypeById(str(form, 'id'));
		if (!type || type.worldId !== world.id) error(404);
		deleteType(type.id);
		return { ok: true };
	},
	share: async ({ request, locals }) => {
		requireOwner(locals);
		const world = locals.world!;
		const form = await request.formData();
		const role = str(form, 'role');
		if (!isRole(role)) return fail(400, { shareError: 'Pick a role.' });
		const r = shareByEmail(world.id, str(form, 'email'), role);
		if (!r.ok) return fail(400, { shareError: r.error });
		return { ok: true };
	},
	setRole: async ({ request, locals }) => {
		requireOwner(locals);
		const world = locals.world!;
		const form = await request.formData();
		const role = str(form, 'role');
		if (isRole(role)) setMemberRole(world.id, str(form, 'id'), role);
		return { ok: true };
	},
	removeMember: async ({ request, locals }) => {
		requireOwner(locals);
		const world = locals.world!;
		const form = await request.formData();
		removeMember(world.id, str(form, 'id'));
		return { ok: true };
	},
	createInvite: async ({ request, locals }) => {
		requireOwner(locals);
		const world = locals.world!;
		if (!locals.user) error(404);
		const form = await request.formData();
		const role = str(form, 'role');
		createInvite(
			world.id,
			isRole(role) ? role : 'viewer',
			locals.user.id,
			Math.min(90, Math.max(1, Number(str(form, 'days')) || 7))
		);
		return { ok: true };
	},
	revokeInvite: async ({ request, locals }) => {
		requireOwner(locals);
		const world = locals.world!;
		const form = await request.formData();
		revokeInvite(world.id, str(form, 'id'));
		return { ok: true };
	},
	deleteUpload: async ({ request, locals }) => {
		const world = locals.world!;
		const form = await request.formData();
		await deleteUpload(world.id, str(form, 'id'));
		return { ok: true };
	},
	deleteUnusedUploads: async ({ locals }) => {
		const world = locals.world!;
		for (const u of listUploads(world.id)) if (!u.referenced) await deleteUpload(world.id, u.id);
		return { ok: true };
	},
	rebuildIndex: async ({ locals }) => {
		const world = locals.world!;
		rebuildIndex(world.id);
		return { ok: true, rebuilt: true };
	}
};
