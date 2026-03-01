-- Initial seed data for SecretLink

-- Insert default anonymous user
INSERT INTO `users` (`email`, `created_at`, `updated_at`) 
VALUES ('anonymous@nicob.ovh', NOW(), NOW());
