CREATE TABLE `comments` (
	`id` text PRIMARY KEY NOT NULL,
	`world_id` text NOT NULL,
	`element_id` text NOT NULL,
	`panel_id` text NOT NULL,
	`body` text NOT NULL,
	`author_id` text,
	`resolved_at` integer,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	FOREIGN KEY (`world_id`) REFERENCES `worlds`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`element_id`) REFERENCES `elements`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`author_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `comments_element` ON `comments` (`element_id`,`created_at`);