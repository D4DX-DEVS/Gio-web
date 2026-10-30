CREATE TABLE `admin_login_throttle` (
	`key` text PRIMARY KEY NOT NULL,
	`failures` integer DEFAULT 0 NOT NULL,
	`window_start` integer NOT NULL,
	`locked_until` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `admin_totp_state` (
	`id` integer PRIMARY KEY NOT NULL,
	`last_step` integer DEFAULT 0 NOT NULL
);
