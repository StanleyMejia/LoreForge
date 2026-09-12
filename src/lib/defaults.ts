import type { FieldDef, Panel } from './types';

interface DefaultType {
	key: string;
	name: string;
	singular: string;
	icon: string;
	color: string;
	panels: Panel[];
}

// Template panels use stable ids; they are re-issued per element on creation.
const info = (id: string, title: string, fields: FieldDef[]): Panel => ({
	id,
	kind: 'info',
	title,
	fields,
	values: {}
});
const text = (id: string, title: string): Panel => ({ id, kind: 'text', title, body: '' });
const list = (id: string, title: string): Panel => ({ id, kind: 'list', title, items: [] });
const stats = (id: string, title: string): Panel => ({ id, kind: 'stats', title, stats: [] });
const links = (id: string, title: string): Panel => ({ id, kind: 'links', title, links: [] });
const gallery = (id: string, title: string): Panel => ({ id, kind: 'gallery', title, images: [] });
const map = (id: string, title: string): Panel => ({
	id,
	kind: 'map',
	title,
	imageUrl: '',
	pins: []
});

const sel = (key: string, label: string, options: string[]): FieldDef => ({
	key,
	label,
	kind: 'select',
	options
});
const txt = (key: string, label: string): FieldDef => ({ key, label, kind: 'text' });
const ref = (key: string, label: string, type: string): FieldDef => ({
	key,
	label,
	kind: 'element',
	ref: type
});

/** Seeded into every new world. Users can edit, reorder, add and remove types afterwards. */
export const DEFAULT_TYPES: DefaultType[] = [
	{
		key: 'character',
		name: 'Characters',
		singular: 'Character',
		icon: '🧑',
		color: '#f59e0b',
		panels: [
			info('basic', 'Basic Information', [
				sel('role', 'Role', ['Protagonist', 'Antagonist', 'Supporting', 'Minor']),
				sel('status', 'Status', ['Alive', 'Dead', 'Unknown']),
				txt('age', 'Age'),
				txt('gender', 'Gender'),
				ref('species', 'Species', 'species'),
				txt('occupation', 'Occupation'),
				ref('home', 'Home', 'location'),
				ref('affiliation', 'Affiliation', 'faction')
			]),
			list('personality', 'Personality Traits'),
			list('physical', 'Physical Traits'),
			stats('stats', 'Statistics'),
			gallery('image', 'Image'),
			text('backstory', 'Backstory'),
			links('connections', 'Connections')
		]
	},
	{
		key: 'location',
		name: 'Locations',
		singular: 'Location',
		icon: '📍',
		color: '#10b981',
		panels: [
			info('basic', 'Basic Information', [
				sel('kind', 'Kind', [
					'Continent',
					'Region',
					'City',
					'Town',
					'Building',
					'Landmark',
					'Planet',
					'Other'
				]),
				ref('parent', 'Located in', 'location'),
				ref('government', 'Ruled by', 'faction'),
				txt('population', 'Population'),
				txt('climate', 'Climate')
			]),
			text('description', 'Description'),
			text('history', 'History'),
			gallery('image', 'Image'),
			links('residents', 'Notable People & Places')
		]
	},
	{
		key: 'map',
		name: 'Maps',
		singular: 'Map',
		icon: '🗺️',
		color: '#84cc16',
		panels: [
			info('basic', 'Basic Information', [
				ref('region', 'Region', 'location'),
				txt('scale', 'Scale')
			]),
			map('map', 'Map'),
			list('legend', 'Legend'),
			links('places', 'Places on this Map')
		]
	},
	{
		key: 'encyclopedia',
		name: 'Encyclopedia',
		singular: 'Entry',
		icon: '📜',
		color: '#a3a3a3',
		panels: [
			info('basic', 'Basic Information', [txt('category', 'Category')]),
			text('overview', 'Overview'),
			links('related', 'Related')
		]
	},
	{
		key: 'magic',
		name: 'Magic',
		singular: 'Magic',
		icon: '✨',
		color: '#8b5cf6',
		panels: [
			info('basic', 'Basic Information', [
				sel('kind', 'Kind', ['Hard', 'Soft', 'Divine', 'Arcane', 'Other']),
				txt('practitioners', 'Practitioners')
			]),
			text('overview', 'Overview'),
			list('source', 'Source'),
			list('costs', 'Costs'),
			list('limitations', 'Limitations'),
			text('history', 'History'),
			links('people', 'Magical People & Places')
		]
	},
	{
		key: 'item',
		name: 'Items',
		singular: 'Item',
		icon: '🗡️',
		color: '#06b6d4',
		panels: [
			info('basic', 'Basic Information', [
				sel('kind', 'Kind', ['Weapon', 'Artifact', 'Tool', 'Document', 'Vehicle', 'Other']),
				ref('owner', 'Owner', 'character'),
				ref('origin', 'Origin', 'location')
			]),
			text('description', 'Description'),
			list('properties', 'Properties'),
			stats('stats', 'Statistics'),
			gallery('image', 'Image'),
			text('history', 'History')
		]
	},
	{
		key: 'species',
		name: 'Species',
		singular: 'Species',
		icon: '🐾',
		color: '#ec4899',
		panels: [
			info('basic', 'Basic Information', [
				txt('lifespan', 'Lifespan'),
				ref('habitat', 'Habitat', 'location'),
				txt('height', 'Average height')
			]),
			text('description', 'Description'),
			list('traits', 'Traits'),
			stats('stats', 'Statistics'),
			gallery('image', 'Image'),
			links('members', 'Notable Members')
		]
	},
	{
		key: 'culture',
		name: 'Cultures',
		singular: 'Culture',
		icon: '🎭',
		color: '#f97316',
		panels: [
			info('basic', 'Basic Information', [
				ref('region', 'Region', 'location'),
				txt('language', 'Language'),
				txt('population', 'Population')
			]),
			text('description', 'Description'),
			text('origins', 'Origins & Homeland'),
			text('social', 'Social Expectations & Behavior'),
			text('history', 'History'),
			text('diaspora', 'Diaspora'),
			text('cuisine', 'Native Cuisine'),
			text('secular', 'Secular Traditions, Festivals, and Beliefs'),
			text('sacred', 'Sacred Traditions, Festivals, and Beliefs'),
			links('members', 'Notable Members')
		]
	},
	{
		key: 'faction',
		name: 'Factions',
		singular: 'Faction',
		icon: '⚔️',
		color: '#ef4444',
		panels: [
			info('basic', 'Basic Information', [
				sel('kind', 'Kind', [
					'Kingdom',
					'Guild',
					'Company',
					'Military',
					'Family',
					'Order',
					'Other'
				]),
				ref('leader', 'Leader', 'character'),
				ref('headquarters', 'Headquarters', 'location')
			]),
			text('overview', 'Overview'),
			list('goals', 'Goals'),
			links('members', 'Members')
		]
	},
	{
		key: 'religion',
		name: 'Religions',
		singular: 'Religion',
		icon: '☯️',
		color: '#eab308',
		panels: [
			info('basic', 'Basic Information', [
				sel('kind', 'Kind', [
					'Monotheistic',
					'Polytheistic',
					'Animist',
					'Ancestor worship',
					'Philosophical',
					'Other'
				]),
				ref('founder', 'Founder', 'character'),
				ref('holy', 'Holy site', 'location')
			]),
			text('overview', 'Overview'),
			list('beliefs', 'Beliefs'),
			list('practices', 'Practices'),
			text('history', 'History'),
			links('followers', 'Followers & Places')
		]
	},
	{
		key: 'philosophy',
		name: 'Philosophies',
		singular: 'Philosophy',
		icon: '☁️',
		color: '#38bdf8',
		panels: [
			info('basic', 'Basic Information', [
				ref('founder', 'Founder', 'character'),
				ref('origin', 'Origin culture', 'culture')
			]),
			text('overview', 'Overview'),
			list('tenets', 'Core Tenets'),
			text('history', 'History'),
			links('adherents', 'Adherents')
		]
	},
	{
		key: 'system',
		name: 'Systems',
		singular: 'System',
		icon: '🧩',
		color: '#3b82f6',
		panels: [
			info('basic', 'Basic Information', [
				sel('kind', 'Kind', ['Government', 'Economy', 'Legal', 'Technology', 'Military', 'Other']),
				ref('scope', 'Scope', 'location')
			]),
			text('overview', 'Overview'),
			list('rules', 'Rules'),
			text('history', 'History')
		]
	},
	{
		key: 'research',
		name: 'Research',
		singular: 'Research note',
		icon: '🔬',
		color: '#94a3b8',
		panels: [
			info('basic', 'Basic Information', [txt('source', 'Source'), txt('url', 'URL')]),
			text('notes', 'Notes'),
			links('related', 'Related')
		]
	}
];

export const TYPE_ICONS = [
	'📄',
	'🧑',
	'📍',
	'🗺️',
	'📜',
	'✨',
	'🗡️',
	'🐾',
	'🎭',
	'⚔️',
	'☯️',
	'☁️',
	'🧩',
	'🔬',
	'🏰',
	'🚀',
	'🧪',
	'💎',
	'🌍',
	'📖',
	'🕯️',
	'🧭',
	'🐉',
	'🏛️'
];
export const TYPE_COLORS = [
	'#f59e0b',
	'#10b981',
	'#84cc16',
	'#a3a3a3',
	'#8b5cf6',
	'#06b6d4',
	'#ec4899',
	'#f97316',
	'#ef4444',
	'#eab308',
	'#38bdf8',
	'#3b82f6',
	'#94a3b8'
];
