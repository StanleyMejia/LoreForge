import type { LayoutServerLoad } from './$types';
import { authConfig } from '$lib/server/auth/config';

export const load: LayoutServerLoad = ({ locals }) => ({
	user: locals.user,
	authEnabled: authConfig.enabled
});
