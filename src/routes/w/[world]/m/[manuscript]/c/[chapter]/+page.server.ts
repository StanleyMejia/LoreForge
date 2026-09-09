import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

/** Chapters are edited in the writing workspace; keep old links working. */
export const load: PageServerLoad = ({ params }) => {
	redirect(301, `/w/${params.world}/write/${params.chapter}`);
};
