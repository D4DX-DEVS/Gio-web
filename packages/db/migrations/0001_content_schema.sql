CREATE TABLE `audit_log` (
	`id` integer PRIMARY KEY NOT NULL,
	`user_id` text,
	`action` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`summary` text,
	`diff_json` text,
	`ip_hash` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `audit_log_entity` ON `audit_log` (`entity_type`,`entity_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `authors` (
	`id` integer PRIMARY KEY NOT NULL,
	`display_name` text NOT NULL,
	`slug` text NOT NULL,
	`user_id` text,
	`legacy_wp_id` integer,
	`source` text DEFAULT 'manual' NOT NULL,
	`source_ref` text,
	`import_run_id` integer,
	`review_state` text DEFAULT 'verified' NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "authors_review_state_check" CHECK(review_state IN ('verified','pending_client','client_approved'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `authors_slug_unique` ON `authors` (`slug`);--> statement-breakpoint
CREATE UNIQUE INDEX `authors_legacy_wp_id_unique` ON `authors` (`legacy_wp_id`);--> statement-breakpoint
CREATE TABLE `categories` (
	`id` integer PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`legacy_wp_id` integer,
	`source` text DEFAULT 'manual' NOT NULL,
	`source_ref` text,
	`import_run_id` integer,
	`review_state` text DEFAULT 'verified' NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	CONSTRAINT "categories_review_state_check" CHECK(review_state IN ('verified','pending_client','client_approved'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `categories_slug_unique` ON `categories` (`slug`);--> statement-breakpoint
CREATE UNIQUE INDEX `categories_legacy_wp_id_unique` ON `categories` (`legacy_wp_id`);--> statement-breakpoint
CREATE TABLE `contact_submissions` (
	`id` integer PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`phone` text,
	`message` text NOT NULL,
	`page_url` text,
	`ip_hash` text,
	`user_agent` text,
	`status` text DEFAULT 'new' NOT NULL,
	`is_legacy` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`purge_after` integer,
	CONSTRAINT "contact_submissions_status_check" CHECK(status IN ('new','read','archived','spam'))
);
--> statement-breakpoint
CREATE INDEX `contact_submissions_status` ON `contact_submissions` (`status`,`created_at`);--> statement-breakpoint
CREATE TABLE `documents` (
	`id` integer PRIMARY KEY NOT NULL,
	`media_id` integer NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`category` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`published_at` integer,
	`sort` integer DEFAULT 0 NOT NULL,
	`source` text DEFAULT 'manual' NOT NULL,
	`source_ref` text,
	`import_run_id` integer,
	`review_state` text DEFAULT 'verified' NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`media_id`) REFERENCES `media`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "documents_status_check" CHECK(status IN ('draft','published','archived')),
	CONSTRAINT "documents_review_state_check" CHECK(review_state IN ('verified','pending_client','client_approved'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `documents_media_id` ON `documents` (`media_id`);--> statement-breakpoint
CREATE TABLE `event_categories` (
	`id` integer PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`legacy_wp_id` integer,
	`source` text DEFAULT 'manual' NOT NULL,
	`source_ref` text,
	`import_run_id` integer,
	`review_state` text DEFAULT 'verified' NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	CONSTRAINT "event_categories_review_state_check" CHECK(review_state IN ('verified','pending_client','client_approved'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `event_categories_slug_unique` ON `event_categories` (`slug`);--> statement-breakpoint
CREATE UNIQUE INDEX `event_categories_legacy_wp_id_unique` ON `event_categories` (`legacy_wp_id`);--> statement-breakpoint
CREATE TABLE `event_category_map` (
	`event_id` integer NOT NULL,
	`category_id` integer NOT NULL,
	PRIMARY KEY(`event_id`, `category_id`),
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`category_id`) REFERENCES `event_categories`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `events` (
	`id` integer PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`description_html` text,
	`legacy_body_html` text,
	`featured_media_id` integer,
	`starts_at` integer NOT NULL,
	`ends_at` integer,
	`all_day` integer DEFAULT false NOT NULL,
	`timezone` text DEFAULT 'Asia/Kolkata' NOT NULL,
	`venue_id` integer,
	`organizer_id` integer,
	`cost` text,
	`website_url` text,
	`registration_url` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`report_post_id` integer,
	`legacy_wp_id` integer,
	`legacy_url` text,
	`source` text DEFAULT 'manual' NOT NULL,
	`source_ref` text,
	`import_run_id` integer,
	`review_state` text DEFAULT 'verified' NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`featured_media_id`) REFERENCES `media`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`venue_id`) REFERENCES `venues`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`organizer_id`) REFERENCES `organizers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`report_post_id`) REFERENCES `posts`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "events_status_check" CHECK(status IN ('draft','scheduled','published','cancelled','archived')),
	CONSTRAINT "events_review_state_check" CHECK(review_state IN ('verified','pending_client','client_approved'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `events_slug_unique` ON `events` (`slug`);--> statement-breakpoint
CREATE UNIQUE INDEX `events_legacy_wp_id_unique` ON `events` (`legacy_wp_id`);--> statement-breakpoint
CREATE INDEX `events_starts` ON `events` (`status`,`starts_at`);--> statement-breakpoint
CREATE TABLE `import_conflicts` (
	`id` integer PRIMARY KEY NOT NULL,
	`run_id` integer NOT NULL,
	`legacy_key` text NOT NULL,
	`field` text NOT NULL,
	`values_json` text NOT NULL,
	`chosen_source` text,
	`resolved_by` text,
	`resolved_at` integer,
	FOREIGN KEY (`run_id`) REFERENCES `import_runs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `import_conflicts_key_field` ON `import_conflicts` (`legacy_key`,`field`);--> statement-breakpoint
CREATE TABLE `import_items` (
	`legacy_key` text PRIMARY KEY NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` integer,
	`content_sha256` text NOT NULL,
	`entity_updated_at` integer,
	`first_run_id` integer NOT NULL,
	`last_run_id` integer NOT NULL,
	`warnings_json` text,
	FOREIGN KEY (`first_run_id`) REFERENCES `import_runs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`last_run_id`) REFERENCES `import_runs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `import_items_entity` ON `import_items` (`entity_type`,`entity_id`);--> statement-breakpoint
CREATE TABLE `import_runs` (
	`id` integer PRIMARY KEY NOT NULL,
	`source_kind` text NOT NULL,
	`source_label` text NOT NULL,
	`source_sha256` text,
	`mode` text NOT NULL,
	`started_at` integer NOT NULL,
	`finished_at` integer,
	`status` text NOT NULL,
	`counts_json` text,
	`report_r2_key` text,
	CONSTRAINT "import_runs_mode_check" CHECK(mode IN ('dry_run','apply','delta')),
	CONSTRAINT "import_runs_status_check" CHECK(status IN ('running','succeeded','failed'))
);
--> statement-breakpoint
CREATE TABLE `leader_groups` (
	`id` integer PRIMARY KEY NOT NULL,
	`scope` text NOT NULL,
	`heading` text,
	`term_label` text,
	`sort` integer NOT NULL,
	`is_visible` integer DEFAULT true NOT NULL,
	`source` text DEFAULT 'manual' NOT NULL,
	`source_ref` text,
	`import_run_id` integer,
	`review_state` text DEFAULT 'verified' NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	CONSTRAINT "leader_groups_scope_check" CHECK(scope IN ('state','district','former')),
	CONSTRAINT "leader_groups_review_state_check" CHECK(review_state IN ('verified','pending_client','client_approved'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `leader_groups_source_ref` ON `leader_groups` (`source_ref`);--> statement-breakpoint
CREATE INDEX `leader_groups_scope_sort` ON `leader_groups` (`scope`,`sort`);--> statement-breakpoint
CREATE TABLE `leaders` (
	`id` integer PRIMARY KEY NOT NULL,
	`group_id` integer NOT NULL,
	`name` text NOT NULL,
	`role_title` text,
	`district` text,
	`description` text,
	`photo_media_id` integer,
	`facebook_url` text,
	`instagram_url` text,
	`other_links_json` text,
	`sort` integer NOT NULL,
	`is_visible` integer DEFAULT true NOT NULL,
	`legacy_source_url` text NOT NULL,
	`source` text DEFAULT 'manual' NOT NULL,
	`source_ref` text,
	`import_run_id` integer,
	`review_state` text DEFAULT 'verified' NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`group_id`) REFERENCES `leader_groups`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`photo_media_id`) REFERENCES `media`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "leaders_review_state_check" CHECK(review_state IN ('verified','pending_client','client_approved'))
);
--> statement-breakpoint
CREATE INDEX `leaders_group_sort` ON `leaders` (`group_id`,`sort`);--> statement-breakpoint
CREATE UNIQUE INDEX `leaders_source_ref` ON `leaders` (`source_ref`);--> statement-breakpoint
CREATE TABLE `legacy_urls` (
	`id` integer PRIMARY KEY NOT NULL,
	`old_path` text NOT NULL,
	`old_path_decoded` text NOT NULL,
	`legacy_type` text NOT NULL,
	`live_status` integer,
	`in_sitemap` text,
	`action` text NOT NULL,
	`new_path` text,
	`recommended_target` text,
	`entity_type` text,
	`entity_id` integer,
	`decision_status` text NOT NULL,
	`decided_by` text,
	`decided_at` integer,
	`note` text,
	`last_verified_at` integer,
	`last_verified_status` integer,
	CONSTRAINT "legacy_urls_action_check" CHECK(action IN ('same_path','redirect_301','gone_410','pending_decision')),
	CONSTRAINT "legacy_urls_decision_check" CHECK(decision_status IN ('verified','needs_client_approval','client_approved'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `legacy_urls_old_path_unique` ON `legacy_urls` (`old_path`);--> statement-breakpoint
CREATE INDEX `legacy_urls_decoded` ON `legacy_urls` (`old_path_decoded`);--> statement-breakpoint
CREATE TABLE `media` (
	`id` integer PRIMARY KEY NOT NULL,
	`r2_bucket` text DEFAULT 'gio-media' NOT NULL,
	`r2_key` text NOT NULL,
	`kind` text NOT NULL,
	`usage_hint` text,
	`original_filename` text NOT NULL,
	`mime_type` text NOT NULL,
	`declared_mime_type` text,
	`byte_size` integer NOT NULL,
	`width` integer,
	`height` integer,
	`sha256` text NOT NULL,
	`alt_text` text,
	`caption` text,
	`title` text,
	`credit` text,
	`variant_of_media_id` integer,
	`variant_role` text,
	`legacy_wp_id` integer,
	`legacy_url` text,
	`legacy_sizes_json` text,
	`file_status` text DEFAULT 'available' NOT NULL,
	`is_public` integer DEFAULT true NOT NULL,
	`uploaded_by` text,
	`source` text DEFAULT 'manual' NOT NULL,
	`source_ref` text,
	`import_run_id` integer,
	`review_state` text DEFAULT 'verified' NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`variant_of_media_id`) REFERENCES `media`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "media_kind_check" CHECK(kind IN ('image','document','video','other')),
	CONSTRAINT "media_variant_role_check" CHECK(variant_role IS NULL OR variant_role IN ('wp_scaled','wp_unscaled_original','wp_pre_edit_original')),
	CONSTRAINT "media_file_status_check" CHECK(file_status IN ('available','missing')),
	CONSTRAINT "media_review_state_check" CHECK(review_state IN ('verified','pending_client','client_approved'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `media_r2_key_unique` ON `media` (`r2_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `media_legacy_url_unique` ON `media` (`legacy_url`);--> statement-breakpoint
CREATE INDEX `media_legacy_wp_id` ON `media` (`legacy_wp_id`);--> statement-breakpoint
CREATE INDEX `media_sha256` ON `media` (`sha256`);--> statement-breakpoint
CREATE TABLE `media_usage` (
	`media_id` integer NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`field` text NOT NULL,
	PRIMARY KEY(`media_id`, `entity_type`, `entity_id`, `field`),
	FOREIGN KEY (`media_id`) REFERENCES `media`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `media_usage_entity` ON `media_usage` (`entity_type`,`entity_id`);--> statement-breakpoint
CREATE TABLE `menu_items` (
	`id` integer PRIMARY KEY NOT NULL,
	`menu_id` integer NOT NULL,
	`parent_id` integer,
	`label` text NOT NULL,
	`url` text,
	`page_id` integer,
	`icon` text,
	`open_in_new_tab` integer DEFAULT false NOT NULL,
	`sort` integer NOT NULL,
	`is_visible` integer DEFAULT true NOT NULL,
	`source` text DEFAULT 'manual' NOT NULL,
	`source_ref` text,
	`import_run_id` integer,
	`review_state` text DEFAULT 'verified' NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`menu_id`) REFERENCES `menus`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`parent_id`) REFERENCES `menu_items`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`page_id`) REFERENCES `pages`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "menu_items_review_state_check" CHECK(review_state IN ('verified','pending_client','client_approved'))
);
--> statement-breakpoint
CREATE INDEX `menu_items_menu_sort` ON `menu_items` (`menu_id`,`parent_id`,`sort`);--> statement-breakpoint
CREATE UNIQUE INDEX `menu_items_source_ref` ON `menu_items` (`source_ref`);--> statement-breakpoint
CREATE TABLE `menus` (
	`id` integer PRIMARY KEY NOT NULL,
	`key` text NOT NULL,
	`label` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `menus_key_unique` ON `menus` (`key`);--> statement-breakpoint
CREATE TABLE `not_found_log` (
	`path` text PRIMARY KEY NOT NULL,
	`hits` integer DEFAULT 1 NOT NULL,
	`referrer` text,
	`first_seen_at` integer NOT NULL,
	`last_seen_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `organizers` (
	`id` integer PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`phone` text,
	`email` text,
	`website` text,
	`legacy_wp_id` integer,
	`source` text DEFAULT 'manual' NOT NULL,
	`source_ref` text,
	`import_run_id` integer,
	`review_state` text DEFAULT 'verified' NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	CONSTRAINT "organizers_review_state_check" CHECK(review_state IN ('verified','pending_client','client_approved'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `organizers_legacy_wp_id_unique` ON `organizers` (`legacy_wp_id`);--> statement-breakpoint
CREATE TABLE `pages` (
	`id` integer PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`template` text DEFAULT 'sections' NOT NULL,
	`template_config` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`published_at` integer,
	`seo_title` text,
	`seo_description` text,
	`og_media_id` integer,
	`show_in_sitemap` integer DEFAULT true NOT NULL,
	`legacy_body_html` text,
	`legacy_wp_id` integer,
	`legacy_url` text,
	`source` text DEFAULT 'manual' NOT NULL,
	`source_ref` text,
	`import_run_id` integer,
	`review_state` text DEFAULT 'verified' NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`og_media_id`) REFERENCES `media`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "pages_template_check" CHECK(template IN ('sections','leaders','post_listing','contact','embed')),
	CONSTRAINT "pages_status_check" CHECK(status IN ('draft','published','private','archived')),
	CONSTRAINT "pages_review_state_check" CHECK(review_state IN ('verified','pending_client','client_approved'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `pages_slug_unique` ON `pages` (`slug`);--> statement-breakpoint
CREATE UNIQUE INDEX `pages_legacy_wp_id_unique` ON `pages` (`legacy_wp_id`);--> statement-breakpoint
CREATE TABLE `post_categories` (
	`post_id` integer NOT NULL,
	`category_id` integer NOT NULL,
	PRIMARY KEY(`post_id`, `category_id`),
	FOREIGN KEY (`post_id`) REFERENCES `posts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `post_tags` (
	`post_id` integer NOT NULL,
	`tag_id` integer NOT NULL,
	PRIMARY KEY(`post_id`, `tag_id`),
	FOREIGN KEY (`post_id`) REFERENCES `posts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `posts` (
	`id` integer PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`title` text DEFAULT '' NOT NULL,
	`excerpt` text,
	`body_html` text NOT NULL,
	`body_json` text,
	`legacy_body_html` text,
	`featured_media_id` integer,
	`author_id` integer,
	`status` text DEFAULT 'draft' NOT NULL,
	`published_at` integer,
	`modified_at` integer,
	`locale` text DEFAULT 'ml' NOT NULL,
	`seo_title` text,
	`seo_description` text,
	`og_media_id` integer,
	`comments_open` integer DEFAULT false NOT NULL,
	`legacy_wp_id` integer,
	`legacy_url` text,
	`source` text DEFAULT 'manual' NOT NULL,
	`source_ref` text,
	`import_run_id` integer,
	`review_state` text DEFAULT 'verified' NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`featured_media_id`) REFERENCES `media`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`author_id`) REFERENCES `authors`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`og_media_id`) REFERENCES `media`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "posts_status_check" CHECK(status IN ('draft','review','scheduled','published','private','archived')),
	CONSTRAINT "posts_review_state_check" CHECK(review_state IN ('verified','pending_client','client_approved'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `posts_slug_unique` ON `posts` (`slug`);--> statement-breakpoint
CREATE UNIQUE INDEX `posts_legacy_wp_id_unique` ON `posts` (`legacy_wp_id`);--> statement-breakpoint
CREATE INDEX `posts_status_published` ON `posts` (`status`,`published_at`);--> statement-breakpoint
CREATE TABLE `published_layouts` (
	`id` integer PRIMARY KEY NOT NULL,
	`page_id` integer NOT NULL,
	`layout_json` text NOT NULL,
	`is_current` integer DEFAULT false NOT NULL,
	`published_by` text,
	`published_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`page_id`) REFERENCES `pages`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `published_layouts_current` ON `published_layouts` (`page_id`) WHERE is_current = 1;--> statement-breakpoint
CREATE TABLE `redirects` (
	`id` integer PRIMARY KEY NOT NULL,
	`from_path` text NOT NULL,
	`to_path` text,
	`status_code` integer DEFAULT 301 NOT NULL,
	`origin` text NOT NULL,
	`legacy_url_id` integer,
	`hits` integer DEFAULT 0 NOT NULL,
	`last_hit_at` integer,
	`note` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`legacy_url_id`) REFERENCES `legacy_urls`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "redirects_status_check" CHECK(status_code IN (301,302,308,410)),
	CONSTRAINT "redirects_origin_check" CHECK(origin IN ('migration','slug_change','manual')),
	CONSTRAINT "redirects_target_check" CHECK((status_code = 410) = (to_path IS NULL))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `redirects_from_path_unique` ON `redirects` (`from_path`);--> statement-breakpoint
CREATE TABLE `review_items` (
	`id` integer PRIMARY KEY NOT NULL,
	`review_key` text NOT NULL,
	`code` text NOT NULL,
	`title` text NOT NULL,
	`entity_type` text,
	`entity_id` text,
	`field` text,
	`current_value` text,
	`suggested_value` text,
	`evidence` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`decision_note` text,
	`decided_by` text,
	`decided_at` integer,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	CONSTRAINT "review_items_status_check" CHECK(status IN ('pending','keep_as_is','change_approved','rejected'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `review_items_review_key_unique` ON `review_items` (`review_key`);--> statement-breakpoint
CREATE INDEX `review_items_status` ON `review_items` (`status`,`code`);--> statement-breakpoint
CREATE TABLE `revisions` (
	`id` integer PRIMARY KEY NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`snapshot_json` text NOT NULL,
	`user_id` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `revisions_entity` ON `revisions` (`entity_type`,`entity_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `section_items` (
	`id` integer PRIMARY KEY NOT NULL,
	`section_id` integer NOT NULL,
	`media_id` integer,
	`heading` text,
	`body` text,
	`link_url` text,
	`link_label` text,
	`open_in_new_tab` integer DEFAULT false NOT NULL,
	`alt_text` text,
	`sort` integer NOT NULL,
	`is_visible` integer DEFAULT true NOT NULL,
	`starts_at` integer,
	`ends_at` integer,
	`source` text DEFAULT 'manual' NOT NULL,
	`source_ref` text,
	`import_run_id` integer,
	`review_state` text DEFAULT 'verified' NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`section_id`) REFERENCES `sections`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`media_id`) REFERENCES `media`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "section_items_review_state_check" CHECK(review_state IN ('verified','pending_client','client_approved'))
);
--> statement-breakpoint
CREATE INDEX `section_items_section_sort` ON `section_items` (`section_id`,`sort`);--> statement-breakpoint
CREATE UNIQUE INDEX `section_items_source_ref` ON `section_items` (`source_ref`);--> statement-breakpoint
CREATE TABLE `sections` (
	`id` integer PRIMARY KEY NOT NULL,
	`page_id` integer NOT NULL,
	`type` text NOT NULL,
	`title` text,
	`data_json` text DEFAULT '{}' NOT NULL,
	`sort` integer NOT NULL,
	`is_visible` integer DEFAULT true NOT NULL,
	`starts_at` integer,
	`ends_at` integer,
	`legacy_ref` text,
	`source` text DEFAULT 'manual' NOT NULL,
	`source_ref` text,
	`import_run_id` integer,
	`review_state` text DEFAULT 'verified' NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`page_id`) REFERENCES `pages`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "sections_type_check" CHECK(type IN ('hero_carousel','image_banner','image','rich_text','instagram_feed','poster_slider','featured_video','logo_carousel','embed','map','contact_form','document_list','cta','latest_posts','upcoming_events')),
	CONSTRAINT "sections_review_state_check" CHECK(review_state IN ('verified','pending_client','client_approved'))
);
--> statement-breakpoint
CREATE INDEX `sections_page_sort` ON `sections` (`page_id`,`sort`);--> statement-breakpoint
CREATE UNIQUE INDEX `sections_source_ref` ON `sections` (`source_ref`);--> statement-breakpoint
CREATE TABLE `site_settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value_json` text NOT NULL,
	`source` text DEFAULT 'manual' NOT NULL,
	`source_ref` text,
	`review_state` text DEFAULT 'verified' NOT NULL,
	`updated_by` text,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	CONSTRAINT "site_settings_review_state_check" CHECK(review_state IN ('verified','pending_client','client_approved'))
);
--> statement-breakpoint
CREATE TABLE `tags` (
	`id` integer PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`legacy_wp_id` integer,
	`source` text DEFAULT 'manual' NOT NULL,
	`source_ref` text,
	`import_run_id` integer,
	`review_state` text DEFAULT 'verified' NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	CONSTRAINT "tags_review_state_check" CHECK(review_state IN ('verified','pending_client','client_approved'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tags_slug_unique` ON `tags` (`slug`);--> statement-breakpoint
CREATE UNIQUE INDEX `tags_legacy_wp_id_unique` ON `tags` (`legacy_wp_id`);--> statement-breakpoint
CREATE TABLE `venues` (
	`id` integer PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`address` text,
	`city` text,
	`district` text,
	`state` text,
	`country` text,
	`postal_code` text,
	`map_embed_url` text,
	`legacy_wp_id` integer,
	`source` text DEFAULT 'manual' NOT NULL,
	`source_ref` text,
	`import_run_id` integer,
	`review_state` text DEFAULT 'verified' NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	CONSTRAINT "venues_review_state_check" CHECK(review_state IN ('verified','pending_client','client_approved'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `venues_legacy_wp_id_unique` ON `venues` (`legacy_wp_id`);