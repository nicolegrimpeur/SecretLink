# SecretLink Server

Modern Node.js/TypeScript backend for SecretLink, a secure secret sharing service.

## Structure

```
src/
├── config/               # Configuration and database
│   ├── env.ts           # Environment validation with Zod
│   └── database.ts      # MySQL connection pool and transactions
├── middleware/          # Express middleware
│   ├── auth.ts          # Authentication (session + PAT)
│   ├── session.ts       # Session management (JWT in cookies)
│   └── errorHandler.ts  # Global error handling
├── modules/             # Feature modules
│   ├── users/           # User authentication & management
│   ├── links/           # Secret link creation & redemption
│   └── tokens/          # Personal Access Tokens (PAT)
├── shared/              # Shared utilities
│   ├── types.ts         # TypeScript types and error classes
│   ├── logger.ts        # Pino logging
│   └── crypto.ts        # AES-256-GCM encryption
├── app.ts               # Express app setup
└── main.ts              # Entry point
```

## Getting Started

### Prerequisites
- Node.js 20+
- MySQL 8.0+
- Docker (optional)

### Development

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Start server
npm start

# Watch mode
npm run dev
```

### Environment Variables

Copy `.env.example` to `.env` and fill in the required values:

```bash
cp .env.example .env
```

### Docker

```bash
# Build and run with Docker Compose
cd ..
docker-compose up --build

# Access the server at http://localhost:3000
```

## API Endpoints

### Authentication
- `POST /secretLink/users/signup` - Register
- `POST /secretLink/users/login` - Login
- `POST /secretLink/users/logout` - Logout (session required)

### User Management
- `GET /secretLink/users/me` - Get user profile (session required)
- `POST /secretLink/users/password` - Change password (session required)
- `DELETE /secretLink/users/me` - Delete user account (session required)
- `DELETE /secretLink/users/me/purge` - Purge old data (session required)

### Personal Access Tokens
- `GET /secretLink/users/tokens` - List tokens (session required)
- `POST /secretLink/users/tokens` - Create token (session required)
- `DELETE /secretLink/users/tokens/:id` - Revoke token (session required)

### Secret Links
- `POST /secretLink/links` - Create anonymous link (public)
- `POST /secretLink/links/bulk` - Create multiple links (auth required, scope: `links:write`)
- `GET /secretLink/links/redeem/:token` - Redeem/decrypt link (public)
- `DELETE /secretLink/links/:token` - Delete link (auth required, scope: `links:delete`)
- `GET /secretLink/links/status` - List links (auth required, scope: `links:read`)

## Authentication Methods

### Session (Browser)
- Login with email/password
- JWT token stored in HttpOnly cookie
- Automatic session validation

### Personal Access Token (API)
- Bearer token in Authorization header: `Authorization: Bearer <token>`
- Scoped access: `links:read`, `links:write`, `links:delete`
- Can be revoked at any time

## Error Handling

Errors follow a consistent JSON format:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message"
  }
}
```

Common error codes:
- `VALIDATION_ERROR` (400) - Invalid input
- `UNAUTHORIZED` (401) - Authentication required or failed
- `FORBIDDEN` (403) - Insufficient permissions
- `NOT_FOUND` (404) - Resource not found
- `LINK_GONE` (410) - Link expired or already used
- `INTERNAL_SERVER_ERROR` (500) - Server error

## Encryption

Secret links use AES-256-GCM encryption with:
- 256-bit master key (stored in `MASTER_KEY_V1`)
- 12-byte random IV (nonce)
- Additional Authenticated Data (AAD) for tampering detection
- Ciphertext is purged after first access

## Development

### Add a new module

1. Create a new folder under `src/modules/myfeature/`
2. Implement the data layer (`myfeature.store.ts`)
3. Add validation schemas (`myfeature.schema.ts`)
4. Create the business logic service (`myfeature.service.ts`)
5. Build the HTTP handlers (`myfeature.controller.ts`)
6. Register routes (`myfeature.routes.ts`)
7. Mount in `src/app.ts`

### Testing

```bash
npm run test
```

## Deployment

### Docker Compose (Production)

```bash
# Create .env file with production values
echo "NODE_ENV=production" > .env
echo "BASE_URL=https://your-domain.com" >> .env
# ... add other required vars

# Start services
docker-compose up -d

# View logs
docker-compose logs -f server
```

### Database Migrations

Ensure your MySQL database has the required tables:

```sql
CREATE TABLE users (
  id INT PRIMARY KEY AUTO_INCREMENT,
  email VARCHAR(320) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  email_verified_at TIMESTAMP NULL,
  password_changed_at TIMESTAMP NULL
);

CREATE TABLE api_tokens (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  token_hash VARCHAR(64) UNIQUE NOT NULL,
  label VARCHAR(255),
  scopes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  revoked_at TIMESTAMP NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE items (
  id INT PRIMARY KEY AUTO_INCREMENT,
  owner_user_id INT NOT NULL,
  item_id VARCHAR(320),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(owner_user_id, item_id),
  FOREIGN KEY (owner_user_id) REFERENCES users(id)
);

CREATE TABLE links (
  id INT PRIMARY KEY AUTO_INCREMENT,
  owner_user_id INT NOT NULL,
  item_id VARCHAR(320),
  link_token VARCHAR(44) UNIQUE NOT NULL,
  cipher_text LONGBLOB,
  nonce BINARY(12),
  key_version INT,
  expires_at TIMESTAMP NULL,
  used_at TIMESTAMP NULL,
  deleted_at TIMESTAMP NULL,
  passphrase_hash VARCHAR(64),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (owner_user_id) REFERENCES users(id)
);

CREATE TABLE audits (
  id INT PRIMARY KEY AUTO_INCREMENT,
  owner_user_id INT NOT NULL,
  item_id VARCHAR(320),
  link_id INT,
  event_type VARCHAR(50),
  ip_hash VARCHAR(64),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (owner_user_id) REFERENCES users(id)
);
```

## License

See LICENSE file in repository
