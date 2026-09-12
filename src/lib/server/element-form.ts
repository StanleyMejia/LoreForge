import type { ElementInput } from './repo/elements';
import { parseJson, parseTags, str } from './form';
import { cleanPanels } from './panels';

/** Translate an element form submission (with a JSON `panels` field) into an ElementInput. */
export function readElementInput(form: FormData): ElementInput {
	return {
		name: str(form, 'name').trim(),
		summary: str(form, 'summary').trim(),
		panels: cleanPanels(parseJson(str(form, 'panels'), [])),
		tags: parseTags(str(form, 'tags')),
		imageUrl: str(form, 'imageUrl').trim(),
		typeId: str(form, 'typeId') || undefined,
		parentId: str(form, 'parentId') || null
	};
}
