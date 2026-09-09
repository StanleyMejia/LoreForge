CREATE TABLE `chapters` (
	`id` text PRIMARY KEY NOT NULL,
	`manuscript_id` text NOT NULL,
	`title` text NOT NULL,
	`synopsis` text DEFAULT '' NOT NULL,
	`body` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`word_count` integer DEFAULT 0 NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	FOREIGN KEY (`manuscript_id`) REFERENCES `manuscripts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `chapters_manuscript_sort` ON `chapters` (`manuscript_id`,`sort_order`);--> statement-breakpoint
CREATE TABLE `element_types` (
	`id` text PRIMARY KEY NOT NULL,
	`world_id` text NOT NULL,
	`key` text NOT NULL,
	`name` text NOT NULL,
	`singular` text NOT NULL,
	`icon` text DEFAULT '📄' NOT NULL,
	`color` text DEFAULT '#94a3b8' NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`panels` text DEFAULT '[]' NOT NULL,
	FOREIGN KEY (`world_id`) REFERENCES `worlds`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `element_types_world_key` ON `element_types` (`world_id`,`key`);--> statement-breakpoint
CREATE TABLE `elements` (
	`id` text PRIMARY KEY NOT NULL,
	`world_id` text NOT NULL,
	`type_id` text NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`summary` text DEFAULT '' NOT NULL,
	`panels` text DEFAULT '[]' NOT NULL,
	`tags` text DEFAULT '[]' NOT NULL,
	`image_url` text DEFAULT '' NOT NULL,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	FOREIGN KEY (`world_id`) REFERENCES `worlds`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`type_id`) REFERENCES `element_types`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `elements_world_slug` ON `elements` (`world_id`,`slug`);--> statement-breakpoint
CREATE INDEX `elements_world_type` ON `elements` (`world_id`,`type_id`);--> statement-breakpoint
CREATE INDEX `elements_world_name` ON `elements` (`world_id`,`name`);--> statement-breakpoint
CREATE TABLE `events` (
	`id` text PRIMARY KEY NOT NULL,
	`world_id` text NOT NULL,
	`title` text NOT NULL,
	`date_label` text DEFAULT '' NOT NULL,
	`sort_key` real DEFAULT 0 NOT NULL,
	`era` text DEFAULT '' NOT NULL,
	`body` text DEFAULT '' NOT NULL,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	FOREIGN KEY (`world_id`) REFERENCES `worlds`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `events_world_sort` ON `events` (`world_id`,`sort_key`);--> statement-breakpoint
CREATE TABLE `links` (
	`world_id` text NOT NULL,
	`source_kind` text NOT NULL,
	`source_id` text NOT NULL,
	`target_id` text NOT NULL,
	FOREIGN KEY (`world_id`) REFERENCES `worlds`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`target_id`) REFERENCES `elements`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `links_target` ON `links` (`target_id`);--> statement-breakpoint
CREATE INDEX `links_source` ON `links` (`source_kind`,`source_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `links_unique` ON `links` (`source_kind`,`source_id`,`target_id`);--> statement-breakpoint
CREATE TABLE `manuscripts` (
	`id` text PRIMARY KEY NOT NULL,
	`world_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	FOREIGN KEY (`world_id`) REFERENCES `worlds`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `relationships` (
	`id` text PRIMARY KEY NOT NULL,
	`world_id` text NOT NULL,
	`from_id` text NOT NULL,
	`to_id` text NOT NULL,
	`label` text NOT NULL,
	`reverse_label` text DEFAULT '' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	FOREIGN KEY (`world_id`) REFERENCES `worlds`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`from_id`) REFERENCES `elements`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`to_id`) REFERENCES `elements`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `relationships_from` ON `relationships` (`from_id`);--> statement-breakpoint
CREATE INDEX `relationships_to` ON `relationships` (`to_id`);--> statement-breakpoint
CREATE TABLE `worlds` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `worlds_slug_unique` ON `worlds` (`slug`);