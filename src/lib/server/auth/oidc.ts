import * as client from 'openid-client';
import { authConfig } from './config';

export class LoginStateError extends Error {}
export class LoginDeniedError extends Error {}

import type { Profile } from './profile';

let configPromise: Promise<client.Configuration> | null = null;

/** Discover the provider once and cache it. Retries on the next call if discovery failed. */
function getConfig(): Promise<client.Configuration> {
	if (!configPromise) {
		const issuer = new URL(authConfig.issuer);
		const insecure = issuer.protocol === 'http:';
		configPromise = client
			.discovery(
				issuer,
				authConfig.clientId,
				undefined,
				authConfig.clientSecret ? client.ClientSecretPost(authConfig.clientSecret) : client.None(),
				insecure ? { execute: [client.allowInsecureRequests] } : undefined
			)
			.catch((e) => {
				configPromise = null;
				throw e;
			});
	}
	return configPromise;
}

const redirectUri = () => `${authConfig.origin.replace(/\/$/, '')}/auth/callback`;

interface LoginState {
	state: string;
	nonce: string;
	verifier: string;
	next: string;
}

/** Build the authorization URL and the opaque state to keep in a short-lived cookie. */
export async function beginLogin(next: string): Promise<{ url: string; cookie: string }> {
	const config = await getConfig();
	const verifier = client.randomPKCECodeVerifier();
	const st: LoginState = {
		state: client.randomState(),
		nonce: client.randomNonce(),
		verifier,
		next
	};
	const url = client.buildAuthorizationUrl(config, {
		redirect_uri: redirectUri(),
		scope: authConfig.scopes,
		code_challenge: await client.calculatePKCECodeChallenge(verifier),
		code_challenge_method: 'S256',
		state: st.state,
		nonce: st.nonce
	});
	return { url: url.href, cookie: Buffer.from(JSON.stringify(st)).toString('base64url') };
}

function readState(cookie: string): LoginState {
	try {
		const st = JSON.parse(Buffer.from(cookie, 'base64url').toString()) as LoginState;
		if (st && st.state && st.nonce && st.verifier) return st;
	} catch {
		/* fall through */
	}
	throw new LoginStateError('missing or invalid login state');
}

/** Exchange the callback for tokens, verify the identity, and apply allowlists. */
export async function completeLogin(callbackUrl: URL, cookie: string) {
	const st = readState(cookie);
	const config = await getConfig();
	// The provider redirected to ORIGIN; rebuild the URL on that origin in case a proxy rewrote it.
	const current = new URL(callbackUrl.pathname + callbackUrl.search, authConfig.origin);
	let tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers;
	try {
		tokens = await client.authorizationCodeGrant(config, current, {
			pkceCodeVerifier: st.verifier,
			expectedState: st.state,
			expectedNonce: st.nonce,
			idTokenExpected: true
		});
	} catch (e) {
		if (e instanceof client.AuthorizationResponseError || e instanceof client.ResponseBodyError)
			throw e;
		throw new LoginStateError(String(e));
	}
	const claims = tokens.claims();
	if (!claims) throw new LoginStateError('no id token');

	// Prefer UserInfo for profile fields; fall back to ID token claims.
	let info: Record<string, unknown> = {};
	try {
		info = await client.fetchUserInfo(config, tokens.access_token, claims.sub);
	} catch {
		info = {};
	}
	const pick = (k: string) => {
		const v = info[k] ?? claims[k];
		return typeof v === 'string' ? v : '';
	};
	const groups = ([] as unknown[])
		.concat(info.groups ?? claims.groups ?? [])
		.map((g) => String(g).toLowerCase());

	const profile: Profile = {
		issuer: claims.iss,
		subject: claims.sub,
		email: pick('email').toLowerCase(),
		name: pick('name') || pick('preferred_username') || pick('email'),
		picture: pick('picture')
	};

	if (authConfig.allowedEmails.length && !authConfig.allowedEmails.includes(profile.email))
		throw new LoginDeniedError(`email ${profile.email || '(none)'} not in AUTH_ALLOWED_EMAILS`);
	if (authConfig.allowedGroups.length && !groups.some((g) => authConfig.allowedGroups.includes(g)))
		throw new LoginDeniedError(
			`groups [${groups.join(', ')}] do not intersect AUTH_ALLOWED_GROUPS`
		);

	const rawNext = st.next || '/';
	return {
		profile,
		idToken: tokens.id_token ?? '',
		next: rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '/'
	};
}

/** RP-initiated logout URL if the provider supports it, else null. */
export async function endSessionUrl(idToken: string): Promise<string | null> {
	const config = await getConfig();
	if (!config.serverMetadata().end_session_endpoint) return null;
	const params: Record<string, string> = {
		post_logout_redirect_uri: `${authConfig.origin.replace(/\/$/, '')}/login`
	};
	if (idToken) params.id_token_hint = idToken;
	return client.buildEndSessionUrl(config, params).href;
}
