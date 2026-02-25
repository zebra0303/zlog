CREATE TABLE `post_likes` (
	`id` text PRIMARY KEY NOT NULL,
	`post_id` text NOT NULL,
	`visitor_id` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`post_id`) REFERENCES `posts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_post_likes_unique` ON `post_likes` (`post_id`,`visitor_id`);--> statement-breakpoint
CREATE INDEX `idx_post_likes_visitor` ON `post_likes` (`visitor_id`);--> statement-breakpoint
CREATE INDEX `idx_posts_cat_status_created` ON `posts` (`category_id`,`status`,`created_at`);