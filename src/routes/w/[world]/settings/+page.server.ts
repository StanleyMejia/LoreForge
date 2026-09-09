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

export const load: PageServerLoad = async ({ parent }) => {
	const { world } = await parent();
	return { fullTypes: listTypes(world.id) };
};

export const actions: Actions = {
	world: async ({ params, request }) => {
		const world = getWorldBySlug(params.world);
		if (!world) error(404);
		const form = await request.formData();
		const name = str(form, 'name').trim();
		if (!name) return fail(400, { error: 'Name is required.' });
		updateWorld(world.id, { name, description: str(form, 'description').trim() });
		return { ok: true };
	},
	deleteWorld: async ({ params, request }) => {
		const world = getWorldBySlug(params.world);
		if (!world) error(404);
		const form = await request.formData();
		if (str(form, 'confirm') !== world.name)
			return fail(400, { deleteError: 'Type the world name exactly to confirm.' });
		deleteWorld(world.id);
		redirect(303, '/');
	},
	addType: async ({ params, request }) => {
		const world = getWorldBySlug(params.world);
		if (!world) error(404);
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
	updateType: async ({ params, request }) => {
		const world = getWorldBySlug(params.world);
		if (!world) error(404);
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
	moveType: async ({ params, request }) => {
		const world = getWorldBySlug(params.world);
		if (!world) error(404);
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
	deleteType: async ({ params, request }) => {
		const world = getWorldBySlug(params.world);
		if (!world) error(404);
		const form = await request.formData();
		const type = getTypeById(str(form, 'id'));
		if (!type || type.worldId !== world.id) error(404);
		deleteType(type.id);
		return { ok: true };
	}
};
