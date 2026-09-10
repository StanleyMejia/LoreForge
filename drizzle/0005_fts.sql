CREATE VIRTUAL TABLE `search_index` USING fts5(
	`world_id` UNINDEXED,
	`kind` UNINDEXED,
	`ref_id` UNINDEXED,
	`title`,
	`body`,
	tokenize = 'porter unicode61'
);
