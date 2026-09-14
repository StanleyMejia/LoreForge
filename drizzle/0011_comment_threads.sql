PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_comments` (
	`id` text PRIMARY KEY NOT NULL,
	`world_id` text NOT NULL,
	`element_id` text,
	`chapter_id` text,
	`panel_id` text DEFAULT '' NOT NULL,
	`parent_id` text,
	`body` text NOT NULL,
	`author_id` text,
	`resolved_at` integer,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	FOREIGN KEY (`world_id`) REFERENCES `worlds`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`element_id`) REFERENCES `elements`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`chapter_id`) REFERENCES `chapters`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`parent_id`) REFERENCES `comments`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`author_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_comments`("id", "world_id", "element_id", "panel_id", "body", "author_id", "resolved_at", "created_at") SELECT "id", "world_id", "element_id", "panel_id", "body", "author_id", "resolved_at", "created_at" FROM `comments`;--> statement-breakpoint
DROP TABLE `comments`;--> statement-breakpoint
ALTER TABLE `__new_comments` RENAME TO `comments`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `comments_element` ON `comments` (`element_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `comments_chapter` ON `comments` (`chapter_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `comments_parent` ON `comments` (`parent_id`);