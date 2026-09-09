CREATE TABLE `world_invites` (
	`id` text PRIMARY KEY NOT NULL,
	`world_id` text NOT NULL,
	`role` text NOT NULL,
	`created_by` text,
	`expires_at` integer NOT NULL,
	`uses` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	FOREIGN KEY (`world_id`) REFERENCES `worlds`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `world_invites_world` ON `world_invites` (`world_id`);--> statement-breakpoint
CREATE TABLE `world_members` (
	`id` text PRIMARY KEY NOT NULL,
	`world_id` text NOT NULL,
	`user_id` text,
	`email` text NOT NULL,
	`role` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	FOREIGN KEY (`world_id`) REFERENCES `worlds`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `world_members_world_email` ON `world_members` (`world_id`,`email`);--> statement-breakpoint
CREATE INDEX `world_members_user` ON `world_members` (`user_id`);