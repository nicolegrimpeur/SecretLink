/**
 * Shared types for SecretLink server
 */

export interface SessionPayload {
  userId: number;
  iat?: number;
  exp?: number;
}

export interface AuthRequest {
  method: 'session' | 'pat' | null;
  userId?: number;
  scopes?: string[];
}

export interface User {
  id: number;
  email: string;
  password_hash: string;
  created_at: Date;
  email_verified_at: Date | null;
  password_changed_at: Date | null;
}

export interface Link {
  id: number;
  owner_user_id: number;
  item_id: string;
  link_token: string;
  cipher_text: Buffer;
  nonce: Buffer;
  key_version: number;
  expires_at: Date | null;
  used_at: Date | null;
  deleted_at: Date | null;
  passphrase_hash: string | null;
  created_at: Date;
}

export interface LinkItem {
  id: number;
  owner_user_id: number;
  item_id: string;
  created_at: Date;
}

export interface ApiToken {
  id: number;
  user_id: number;
  token_hash: string;
  label: string;
  scopes: string;
  created_at: Date;
  revoked_at: Date | null;
}

export interface AuditLog {
  id: number;
  owner_user_id: number;
  item_id: string;
  link_id: number;
  event_type: string;
  ip_hash: string | null;
  user_agent: string | null;
  created_at: Date;
}

export interface PaginationOptions {
  limit: number;
  offset: number;
}

export interface LinkStatus {
  link_token: string;
  item_id: string;
  expires_at: Date | null;
  used_at: Date | null;
  deleted_at: Date | null;
  created_at: Date;
}

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(400, 'VALIDATION_ERROR', message);
    this.name = 'ValidationError';
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized') {
    super(401, 'UNAUTHORIZED', message);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Forbidden') {
    super(403, 'FORBIDDEN', message);
    this.name = 'ForbiddenError';
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = 'Not found') {
    super(404, 'NOT_FOUND', message);
    this.name = 'NotFoundError';
  }
}
