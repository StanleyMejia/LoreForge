import type { PageServerLoad } from './$types';
import { allRelationships } from '$lib/server/repo/elements';
import { db, schema } from '$lib/server/db';
import { eq } from 'drizzle-orm';

export const load: PageServerLoad = async ({ parent }) => {
	const { world, index, types } = await parent();
	const colors = new Map(types.map((t) => [t.key, t.color]));
	const nodes = index.map((e) => ({
		id: e.id,
		slug: e.slug,
		name: e.name,
		icon: e.icon,
		color: colors.get(e.typeKey) ?? '#94a3b8'
	}));
	const rels = allRelationships(world.id).map((r) => ({
		source: r.fromId,
		target: r.toId,
		label: r.label,
		kind: 'relationship' as const
	}));
	const mentions = db
		.select({ source: schema.links.sourceId, target: schema.links.targetId })
		.from(schema.links)
		.where(eq(schema.links.sourceKind, 'element'))
		.all()
		.map((l) => ({ ...l, label: 'mentions', kind: 'mention' as const }));
	return { nodes, edges: [...rels, ...mentions] };
};
