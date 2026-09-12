import { Marked, type Tokens } from 'marked';

export interface LinkTarget {
	slug: string;
	name: string;
	icon?: string;
	summary?: string;
}

export interface RenderContext {
	/** Base path for element links, e.g. `/w/my-world/e/` */
	elementBase: string;
	/** Case-insensitive lookup by element name (or slug). */
	resolve: (name: string) => LinkTarget | undefined;
	/** Render `[[wiki links]]` as their text alone — for exports, where app URLs mean nothing. */
	plain?: boolean;
}

const WIKI_RE = /\[\[([^\]|]+?)(?:\|([^\]]+?))?\]\]/g;

/** Every [[target]] mentioned in a markdown body, deduplicated, code fences ignored. */
export function extractWikiLinks(md: string): string[] {
	const stripped = md.replace(/```[\s\S]*?```/g, '').replace(/`[^`\n]*`/g, '');
	const out = new Set<string>();
	for (const m of stripped.matchAll(WIKI_RE)) out.add(m[1].trim());
	return [...out];
}

export function escapeHtml(s: string): string {
	return s
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

function safeHref(href: string): string | null {
	const h = href.trim();
	if (/^(https?:|mailto:|\/|#|\.\/|\.\.\/)/i.test(h)) return h;
	if (!/^[a-z][a-z0-9+.-]*:/i.test(h)) return h; // scheme-less relative path
	return null;
}

interface WikiToken extends Tokens.Generic {
	type: 'wikilink';
	target: string;
	text: string;
}

export function createMarkdown(ctx: RenderContext): Marked {
	const md = new Marked({ gfm: true, breaks: true });
	md.use({
		extensions: [
			{
				name: 'wikilink',
				level: 'inline',
				start(src) {
					return src.indexOf('[[');
				},
				tokenizer(src) {
					const m = /^\[\[([^\]|]+?)(?:\|([^\]]+?))?\]\]/.exec(src);
					if (!m) return undefined;
					const tok: WikiToken = {
						type: 'wikilink',
						raw: m[0],
						target: m[1].trim(),
						text: (m[2] ?? m[1]).trim()
					};
					return tok;
				},
				renderer(token) {
					const t = token as WikiToken;
					if (ctx.plain) return escapeHtml(t.text);
					const hit = ctx.resolve(t.target);
					if (hit) {
						const tip = hit.summary ? `${hit.name} — ${hit.summary}` : hit.name;
						return `<a class="wikilink" href="${ctx.elementBase}${encodeURIComponent(hit.slug)}" title="${escapeHtml(tip)}">${escapeHtml(t.text)}</a>`;
					}
					return `<a class="wikilink wikilink-missing" href="${ctx.elementBase}new?name=${encodeURIComponent(t.target)}" title="Create &quot;${escapeHtml(t.target)}&quot;">${escapeHtml(t.text)}</a>`;
				}
			}
		],
		renderer: {
			// Raw HTML is rendered as literal text; the app is markdown-only.
			html({ text }) {
				return escapeHtml(text);
			},
			link({ href, title, tokens }) {
				const safe = safeHref(href);
				const inner = this.parser.parseInline(tokens);
				if (!safe) return inner;
				const t = title ? ` title="${escapeHtml(title)}"` : '';
				const ext = /^https?:/i.test(safe) ? ' target="_blank" rel="noopener noreferrer"' : '';
				return `<a href="${escapeHtml(safe)}"${t}${ext}>${inner}</a>`;
			},
			image({ href, title, text }) {
				const safe = safeHref(href);
				if (!safe) return escapeHtml(text);
				const t = title ? ` title="${escapeHtml(title)}"` : '';
				return `<img src="${escapeHtml(safe)}" alt="${escapeHtml(text)}"${t} loading="lazy" />`;
			}
		}
	});
	return md;
}

export function renderMarkdown(source: string, ctx: RenderContext): string {
	return createMarkdown(ctx).parse(source, { async: false }) as string;
}

/** Build a resolver from a list of elements. Matches by name or slug, case-insensitively. */
export function makeResolver(items: LinkTarget[]): RenderContext['resolve'] {
	const map = new Map<string, LinkTarget>();
	for (const it of items) {
		map.set(it.name.toLowerCase(), it);
		map.set(it.slug.toLowerCase(), it);
	}
	return (name) => map.get(name.trim().toLowerCase());
}
