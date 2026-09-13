import tailwindcss from '@tailwindcss/vite';
import adapter from '@sveltejs/adapter-node';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit({
			compilerOptions: {
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			adapter: adapter({ out: 'build' }),
			/**
			 * Every build hashes its JS chunks afresh, so a tab left open across a deploy holds
			 * references to files that no longer exist. Without this, its next client-side
			 * navigation imports a 404 and dies after the URL has already changed — the address
			 * bar moves and the page does not. Polling lets the app notice a new version and
			 * reload instead (see +layout.svelte).
			 */
			version: { pollInterval: 300_000 },
			/**
			 * SvelteKit adds its own hashes/nonces to script-src, so inline hydration keeps working.
			 *
			 * style-src needs unsafe-inline because map pins and the relationship graph position
			 * themselves with style attributes, which no hash can cover. Style injection is a far
			 * smaller problem than script injection, and script-src stays strict.
			 *
			 * img-src is wide on purpose: an image panel may point at any https URL or a data: URI
			 * (see IMAGE_URL in server/panels.ts), and the favicon is itself inlined as data:.
			 */
			csp: {
				directives: {
					'default-src': ['self'],
					'script-src': ['self'],
					'style-src': ['self', 'unsafe-inline'],
					'img-src': ['self', 'data:', 'https:'],
					'font-src': ['self', 'data:'],
					'connect-src': ['self'],
					'form-action': ['self'],
					'frame-ancestors': ['none'],
					'base-uri': ['self'],
					'object-src': ['none']
				}
			},
			typescript: {
				config: (config) => {
					config.include.push('../drizzle.config.ts');
				}
			}
		})
	]
});
