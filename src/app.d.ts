// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			user: import('$lib/server/auth/session').SessionUser | null;
			session: { id: string; idToken: string; expiresAt: Date } | null;
			/** Set for requests under /w/[slug]: the world and the caller's role in it. */
			world: { id: string; slug: string; role: import('$lib/server/db/schema').WorldRole } | null;
		}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
