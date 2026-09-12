import { escapeHtml } from './markdown';

/** Private markers SQLite's snippet() wraps matched terms in, before the page escapes the text. */
export const MARK_OPEN = String.fromCharCode(1);
export const MARK_CLOSE = String.fromCharCode(2);

/** Escape a snippet from the search index and turn its private markers into <mark>. */
export function snippetHtml(s: string): string {
	return escapeHtml(s).replaceAll(MARK_OPEN, '<mark>').replaceAll(MARK_CLOSE, '</mark>');
}
