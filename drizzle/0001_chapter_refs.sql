CREATE TABLE `chapter_refs` (
	`id` text PRIMARY KEY NOT NULL,
	`chapter_id` text NOT NULL,
	`element_id` text NOT NULL,
	`role` text NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`chapter_id`) REFERENCES `chapters`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`element_id`) REFERENCES `elements`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `chapter_refs_unique` ON `chapter_refs` (`chapter_id`,`element_id`,`role`);--> statement-breakpoint
CREATE INDEX `chapter_refs_element` ON `chapter_refs` (`element_id`);--> statement-breakpoint
ALTER TABLE `chapters` ADD `event_id` text REFERENCES events(id) ON DELETE SET NULL;