-- Initial seed data for SecretLink

-- Insert default anonymous user
INSERT INTO `users` (`id`, `email`, `created_at`, `updated_at`) 
VALUES (1, 'anonymous@nicob.ovh', NOW(), NOW());
