import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { authConfig } from '$lib/server/auth/config';
import { acceptInvite } from '$lib/server/repo/members';

/** Redeem an invite link. The hook already forced a login (with `next` pointing back here). */
export const load: PageServerLoad = ({ params, locals }) => {
	if (!authConfig.enabled) error(404, 'Sharing requires sign-in to be enabled');
	if (!locals.user) redirect(303, `/login?next=${encodeURIComponent(`/invite/${params.token}`)}`);
	const result = acceptInvite(params.token, locals.user.id, locals.user.email);
	if (!result) error(410, 'This invite link is invalid or has expired.');
	redirect(303, `/w/${result.slug}`);
};
