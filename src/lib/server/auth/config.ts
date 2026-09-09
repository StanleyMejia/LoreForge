import { env } from '$env/dynamic/private';

const list = (v: string | undefined) =>
	(v ?? '')
		.split(',')
		.map((s) => s.trim().toLowerCase())
		.filter(Boolean);

/**
 * Authentication settings from the environment. Auth is enabled only when OIDC_ISSUER is set;
 * otherwise the instance is open (suitable for a trusted LAN or local development).
 */
export const authConfig = {
	enabled: !!env.OIDC_ISSUER,
	issuer: env.OIDC_ISSUER ?? '',
	clientId: env.OIDC_CLIENT_ID ?? '',
	clientSecret: env.OIDC_CLIENT_SECRET || undefined,
	scopes: env.OIDC_SCOPES || 'openid profile email',
	providerName: env.OIDC_PROVIDER_NAME || 'SSO',
	allowedEmails: list(env.AUTH_ALLOWED_EMAILS),
	allowedGroups: list(env.AUTH_ALLOWED_GROUPS),
	sessionTtlMs: Math.max(1, Number(env.SESSION_TTL_DAYS) || 30) * 86_400_000,
	origin: env.ORIGIN || 'http://localhost:3000'
};

if (authConfig.enabled) {
	if (!authConfig.clientId)
		console.error('[auth] OIDC_ISSUER is set but OIDC_CLIENT_ID is missing');
	if (authConfig.allowedGroups.length && !/\bgroups\b/.test(authConfig.scopes))
		authConfig.scopes += ' groups';
	console.log(
		`[auth] OIDC enabled: issuer=${authConfig.issuer} redirect=${authConfig.origin}/auth/callback`
	);
} else {
	console.warn('[auth] OIDC_ISSUER not set: running without authentication');
}
