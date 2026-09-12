import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import {
	createEvent,
	deleteEvent,
	getEvent,
	listEvents,
	type EventInput
} from '$lib/server/repo/timeline';
import { updateEvent } from '$lib/server/repo/timeline';
import { makeResolver, renderMarkdown } from '$lib/markdown';
import { num, str } from '$lib/server/form';
import { chaptersForEvents } from '$lib/server/repo/manuscripts';

export const load: PageServerLoad = async ({ parent, url }) => {
	const { world, index } = await parent();
	const ctx = { elementBase: `/w/${world.slug}/e/`, resolve: makeResolver(index) };
	const raw = listEvents(world.id);
	const told = chaptersForEvents(raw.map((e) => e.id));
	const events = raw.map((e) => ({
		...e,
		html: renderMarkdown(e.body, ctx),
		chapters: told.get(e.id) ?? []
	}));
	const editId = url.searchParams.get('edit');
	const editing = editId ? (events.find((e) => e.id === editId) ?? null) : null;
	return { events, editing };
};

function readEvent(form: FormData): EventInput {
	return {
		title: str(form, 'title').trim(),
		dateLabel: str(form, 'dateLabel').trim(),
		sortKey: num(form, 'sortKey', 0),
		era: str(form, 'era').trim(),
		body: str(form, 'body')
	};
}

export const actions: Actions = {
	create: async ({ request, locals }) => {
		const world = locals.world!;
		const form = await request.formData();
		const input = readEvent(form);
		if (!input.title) return fail(400, { error: 'Title is required.' });
		if (!str(form, 'sortKey').trim()) delete input.sortKey;
		const ev = createEvent(world.id, input);
		redirect(303, `/w/${world.slug}/timeline#${ev.id}`);
	},
	update: async ({ request, locals }) => {
		const world = locals.world!;
		const form = await request.formData();
		const id = str(form, 'id');
		if (!getEvent(world.id, id)) error(404);
		const input = readEvent(form);
		if (!input.title) return fail(400, { error: 'Title is required.' });
		updateEvent(world.id, id, input);
		redirect(303, `/w/${world.slug}/timeline#${id}`);
	},
	delete: async ({ request, locals }) => {
		const world = locals.world!;
		const form = await request.formData();
		deleteEvent(world.id, str(form, 'id'));
		redirect(303, `/w/${world.slug}/timeline`);
	}
};
