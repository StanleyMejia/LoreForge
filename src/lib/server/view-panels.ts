import { getElementsByIds, mapOwners } from './repo/elements';
import { renderMarkdown, type RenderContext } from '$lib/markdown';
import { refList, type Panel, type ViewPanel } from '$lib/types';

export function prepare(panels: Panel[], worldSlug: string, ctx: RenderContext): ViewPanel[] {
	const refIds = new Set<string>();
	for (const p of panels) {
		if (p.kind === 'info')
			for (const f of p.fields)
				if (f.kind === 'element') for (const id of refList(p.values[f.key])) refIds.add(id);
		if (p.kind === 'links') for (const l of p.links) refIds.add(l.elementId);
		if (p.kind === 'map') for (const pin of p.pins) if (pin.elementId) refIds.add(pin.elementId);
	}
	const refs = new Map(getElementsByIds([...refIds]).map((e) => [e.id, e]));
	// Which pin targets carry a map of their own, so the pin can be shown as a way in.
	const drillable = mapOwners(
		panels.flatMap((p) =>
			p.kind === 'map' ? p.pins.map((pin) => pin.elementId).filter(Boolean) : []
		)
	);
	const out: ViewPanel[] = [];
	for (const p of panels) {
		switch (p.kind) {
			case 'info': {
				const rows = [];
				for (const f of p.fields) {
					const raw = p.values[f.key];
					if (!raw) continue;
					if (f.kind === 'element') {
						const found = refList(raw)
							.map((id) => refs.get(id))
							.filter((r) => r !== undefined);
						if (!found.length) continue;
						const [r] = found;
						rows.push({
							key: f.key,
							label: f.label,
							kind: f.kind,
							value: found.map((x) => x.name).join(', '),
							href: `/w/${worldSlug}/e/${r.slug}`,
							icon: r.typeIcon,
							...(f.multiple
								? {
										refs: found.map((x) => ({
											name: x.name,
											href: `/w/${worldSlug}/e/${x.slug}`,
											icon: x.typeIcon
										}))
									}
								: {})
						});
					} else
						rows.push({
							key: f.key,
							label: f.label,
							kind: f.kind,
							value: raw,
							href: null,
							icon: null
						});
				}
				if (rows.length) out.push({ id: p.id, kind: 'info', title: p.title, rows });
				break;
			}
			case 'text':
				if (p.body.trim())
					out.push({ id: p.id, kind: 'text', title: p.title, html: renderMarkdown(p.body, ctx) });
				break;
			case 'list':
				if (p.items.length)
					out.push({
						id: p.id,
						kind: 'list',
						title: p.title,
						items: p.items.map((i) => ({ name: i.name, html: renderMarkdown(i.text, ctx) }))
					});
				break;
			case 'stats':
				if (p.stats.length) out.push({ id: p.id, kind: 'stats', title: p.title, stats: p.stats });
				break;
			case 'links': {
				const links = p.links
					.map((l) => {
						const r = refs.get(l.elementId);
						return r
							? { name: r.name, slug: r.slug, icon: r.typeIcon, typeName: r.typeName, note: l.note }
							: null;
					})
					.filter((l) => l !== null);
				if (links.length) out.push({ id: p.id, kind: 'links', title: p.title, links });
				break;
			}
			case 'gallery':
				if (p.images.length)
					out.push({ id: p.id, kind: 'gallery', title: p.title, images: p.images });
				break;
			case 'map':
				if (p.imageUrl || p.pins.length)
					out.push({
						id: p.id,
						kind: 'map',
						title: p.title,
						imageUrl: p.imageUrl,
						pins: p.pins.map((pin) => {
							const r = pin.elementId ? refs.get(pin.elementId) : undefined;
							return {
								...pin,
								element: r
									? { name: r.name, slug: r.slug, icon: r.typeIcon, summary: r.summary }
									: null,
								childMap: r ? drillable.has(r.id) : false
							};
						})
					});
				break;
		}
	}
	return out;
}
