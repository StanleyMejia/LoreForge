const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

export function timeAgo(d: Date | number | string): string {
	const t = d instanceof Date ? d.getTime() : new Date(d).getTime();
	const diff = (t - Date.now()) / 1000;
	const abs = Math.abs(diff);
	if (abs < 60) return 'just now';
	if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute');
	if (abs < 86400) return rtf.format(Math.round(diff / 3600), 'hour');
	if (abs < 86400 * 30) return rtf.format(Math.round(diff / 86400), 'day');
	return new Date(t).toLocaleDateString();
}

export function fmtNumber(n: number): string {
	return new Intl.NumberFormat('en').format(n);
}
