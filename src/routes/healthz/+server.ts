import type { RequestHandler } from './$types';

/** Unauthenticated liveness probe for Docker/Kubernetes healthchecks. */
export const GET: RequestHandler = () =>
	new Response('ok', { headers: { 'content-type': 'text/plain' } });
