--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
CREATE TABLE `users` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `email` varchar(320) NOT NULL,
  `password_hash` varbinary(255) DEFAULT NULL,
  `password_changed_at` datetime DEFAULT NULL,
  `email_verified_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Table structure for table `items`
--

DROP TABLE IF EXISTS `items`;
CREATE TABLE `items` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `owner_user_id` bigint NOT NULL,
  `item_id` varchar(320) NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_owner_item` (`owner_user_id`,`item_id`),
  KEY `ix_items_owner_created` (`owner_user_id`,`created_at`),
  CONSTRAINT `fk_items_owner` FOREIGN KEY (`owner_user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Table structure for table `links`
--

DROP TABLE IF EXISTS `links`;
CREATE TABLE `links` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `owner_user_id` bigint NOT NULL,
  `item_id` varchar(320) NOT NULL,
  `link_token` char(43) NOT NULL,
  `cipher_text` longblob NOT NULL,
  `nonce` varbinary(12) NOT NULL,
  `key_version` int NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `expires_at` datetime DEFAULT NULL,
  `used_at` datetime DEFAULT NULL,
  `deleted_at` datetime DEFAULT NULL,
  `passphrase_hash` char(64) CHARACTER SET ascii COLLATE ascii_general_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_links_token` (`link_token`),
  KEY `ix_links_owner_item` (`owner_user_id`,`item_id`),
  KEY `ix_links_created` (`created_at`),
  KEY `ix_links_expires` (`expires_at`),
  KEY `ix_links_status` (`used_at`,`deleted_at`),
  CONSTRAINT `fk_links_owner` FOREIGN KEY (`owner_user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Table structure for table `api_tokens`
--

DROP TABLE IF EXISTS `api_tokens`;
CREATE TABLE `api_tokens` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `user_id` bigint NOT NULL,
  `token_hash` char(64) NOT NULL,
  `label` varchar(128) DEFAULT NULL,
  `scopes` json NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `revoked_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_api_tokens_hash` (`token_hash`),
  KEY `ix_api_tokens_user` (`user_id`),
  KEY `ix_api_tokens_revoked` (`revoked_at`),
  CONSTRAINT `fk_api_tokens_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Table structure for table `audits`
--

DROP TABLE IF EXISTS `audits`;
CREATE TABLE `audits` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `owner_user_id` bigint NOT NULL,
  `item_id` varchar(320) NOT NULL,
  `link_id` bigint DEFAULT NULL,
  `event_type` enum('LINK_CREATED','LINK_REDEEMED','LINK_DELETED','LINK_EXPIRED') NOT NULL,
  `ip_hash` char(64) DEFAULT NULL,
  `user_agent` varchar(512) DEFAULT NULL,
  `at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `ix_audits_owner_item` (`owner_user_id`,`item_id`,`at`),
  KEY `ix_audits_link` (`link_id`),
  KEY `ix_audits_type_time` (`event_type`,`at`),
  CONSTRAINT `fk_audits_link` FOREIGN KEY (`link_id`) REFERENCES `links` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_audits_owner` FOREIGN KEY (`owner_user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
