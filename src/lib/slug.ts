export function slugify(input: string): string {
	const s = input
		.normalize('NFKD')
		.replace(/[̀-ͯ]/g, '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 80);
	return s || 'untitled';
}

export function countWords(text: string): number {
	const m = text.trim().match(/\S+/g);
	return m ? m.length : 0;
}
