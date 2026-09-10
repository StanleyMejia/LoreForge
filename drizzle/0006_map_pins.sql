CREATE TABLE `map_pins` (
	`id` text PRIMARY KEY NOT NULL,
	`world_id` text NOT NULL,
	`map_element_id` text NOT NULL,
	`panel_id` text NOT NULL,
	`pin_id` text NOT NULL,
	`element_id` text NOT NULL,
	`label` text DEFAULT '' NOT NULL,
	FOREIGN KEY (`world_id`) REFERENCES `worlds`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`map_element_id`) REFERENCES `elements`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`element_id`) REFERENCES `elements`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `map_pins_element` ON `map_pins` (`element_id`);--> statement-breakpoint
CREATE INDEX `map_pins_map` ON `map_pins` (`map_element_id`);