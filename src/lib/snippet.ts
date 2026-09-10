import { escapeHtml } from './markdown';

const OPEN = String.fromCharCode(1);
const CLOSE = String.fromCharCode(2);

/** Escape a snippet from the search index and turn its private markers into <mark>. */
export function snippetHtml(s: string): string {
	return escapeHtml(s).replaceAll(OPEN, '<mark>').replaceAll(CLOSE, '</mark>');
}
