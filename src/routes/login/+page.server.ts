import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { authConfig } from '$lib/server/auth/config';

const ERRORS: Record<string, string> = {
	denied: 'Your account is not allowed to use this instance.',
	state: 'The sign-in attempt expired or was tampered with. Please try again.',
	provider: 'The identity provider returned an error. Please try again.',
	config: 'Sign-in is not configured correctly on the server. Check the OIDC_* settings.'
};

export const load: PageServerLoad = ({ locals, url }) => {
	if (!authConfig.enabled || locals.user) redirect(303, '/');
	const next = url.searchParams.get('next') ?? '/';
	const code = url.searchParams.get('error');
	return {
		provider: authConfig.providerName,
		next: next.startsWith('/') && !next.startsWith('//') ? next : '/',
		error: code ? (ERRORS[code] ?? 'Sign-in failed.') : null
	};
};
