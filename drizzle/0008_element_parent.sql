ALTER TABLE `elements` ADD `parent_id` text REFERENCES elements(id) ON DELETE SET NULL;--> statement-breakpoint
CREATE INDEX `elements_world_parent` ON `elements` (`world_id`,`parent_id`);--> statement-breakpoint
UPDATE `elements` SET `parent_id` = (
	SELECT json_extract(p.value, '$.values.parent') FROM json_each(`elements`.`panels`) p
	WHERE json_extract(p.value, '$.kind') = 'info'
		AND json_extract(p.value, '$.values.parent') IS NOT NULL
		AND EXISTS (SELECT 1 FROM `elements` t WHERE t.id = json_extract(p.value, '$.values.parent'))
	LIMIT 1
) WHERE `parent_id` IS NULL