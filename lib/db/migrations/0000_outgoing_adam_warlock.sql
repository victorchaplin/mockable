CREATE TABLE `generations` (
	`id` text PRIMARY KEY NOT NULL,
	`prompt` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `pages` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`name` text NOT NULL,
	`title` text NOT NULL,
	`is_entry` integer DEFAULT false NOT NULL,
	`html` text NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `pages_project_name_unique` ON `pages` (`project_id`,`name`);--> statement-breakpoint
CREATE TABLE `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`prompt` text NOT NULL,
	`archetype` text NOT NULL,
	`share_slug` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `projects_share_slug_unique` ON `projects` (`share_slug`);--> statement-breakpoint
CREATE TABLE `proposals` (
	`id` text PRIMARY KEY NOT NULL,
	`generation_id` text NOT NULL,
	`variant_index` integer NOT NULL,
	`archetype` text NOT NULL,
	`html` text NOT NULL,
	`created_at` text NOT NULL,
	`picked_at` text,
	FOREIGN KEY (`generation_id`) REFERENCES `generations`(`id`) ON UPDATE no action ON DELETE cascade
);
