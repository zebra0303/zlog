CREATE TABLE `daily_visitor_counts` (
	`date` text PRIMARY KEY NOT NULL,
	`count` integer DEFAULT 0 NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `visitor_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`ip` text,
	`country` text,
	`user_agent` text,
	`visited_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_visitor_logs_date` ON `visitor_logs` (`visited_at`);
