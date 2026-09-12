CREATE TABLE `revisions` (
	`id` text PRIMARY KEY NOT NULL,
	`world_id` text NOT NULL,
	`kind` text NOT NULL,
	`doc_id` text NOT NULL,
	`title` text DEFAULT '' NOT NULL,
	`content` text NOT NULL,
	`label` text DEFAULT '' NOT NULL,
	`author_id` text,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	FOREIGN KEY (`world_id`) REFERENCES `worlds`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`author_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `revisions_doc` ON `revisions` (`doc_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `revisions_world` ON `revisions` (`world_id`);