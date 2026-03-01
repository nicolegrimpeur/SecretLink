# SecretLink Server - Architecture Guide

## Overview

The SecretLink server is a modern Node.js backend built with TypeScript and Express, designed for secure secret sharing. The architecture focuses on clarity, maintainability, and security.

## Design Principles

1. **Type-Safe**: Full TypeScript with strict mode enabled
2. **Modular**: Feature-organized modules with clear separation of concerns
3. **Secure**: AES-256-GCM encryption, secure session management, input validation
4. **Observable**: Structured logging with Pino
5. **Scalable**: Database connection pooling, transaction support
6. **Containerized**: Docker-native deployment

## Directory Structure

```
src/
├── config/
│   ├── env.ts              # Zod schema for environment validation
│   └── database.ts         # MySQL pool and transaction utilities
│
├── middleware/
│   ├── auth.ts             # Combined session + PAT authentication
│   ├── session.ts          # JWT session management
│   └── errorHandler.ts     # Global error handling and async wrapper
│
├── modules/
│   ├── users/              # User authentication and management
│   │   ├── user.store.ts   # Data access layer
│   │   ├── user.service.ts # Business logic
│   │   ├── user.controller.ts # HTTP handlers
│   │   ├── user.routes.ts  # Route definitions
│   │   └── user.schema.ts  # Zod validation schemas
│   │
│   ├── links/              # Secret link management
│   │   ├── link.store.ts
│   │   ├── link.service.ts
│   │   ├── link.controller.ts
│   │   ├── link.routes.ts
│   │   └── link.schema.ts
│   │
│   └── tokens/             # Personal Access Tokens
│       ├── token.store.ts
│       ├── token.service.ts
│       ├── token.controller.ts
│       └── token.schema.ts
│
├── shared/
│   ├── types.ts            # Shared TypeScript interfaces and error classes
│   ├── logger.ts           # Pino HTTP and context loggers
│   └── crypto.ts           # AES-256-GCM encryption utilities
│
├── app.ts                  # Express app factory
└── main.ts                 # Server entry point
```

## Layered Architecture

Each module follows a clean layered architecture:

### 1. **Store Layer** (Data Access)
```typescript
// user.store.ts
class UserStore {
  async findByEmail(email: string): Promise<User | null>
  async createUser(email: string, hash: Buffer): Promise<{ insertId: number }>
  // ... other CRUD operations
}
```

**Responsibility**: Database queries, connection management, transaction handling  
**Input**: Primitives and simple objects  
**Output**: Raw database records or void

### 2. **Schema Layer** (Validation)
```typescript
// user.schema.ts
export const SignupReqSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
})
```

**Responsibility**: Zod schemas for request/response validation  
**Input**: User input, database records  
**Output**: Validated typed objects

### 3. **Service Layer** (Business Logic)
```typescript
// user.service.ts
class UserService {
  async signup(email: string, password: string): Promise<PublicUser>
  async login(email: string, password: string): Promise<PublicUser>
  async deleteUser(userId: number): Promise<void>
}
```

**Responsibility**: Business logic, transactions, orchestration  
**Input**: Validated data from controller  
**Output**: Domain objects or void  
**Notes**: Throws typed `AppError` for error handling

### 4. **Controller Layer** (HTTP Handlers)
```typescript
// user.controller.ts
export const signup = asyncHandler(async (req: Request, res: Response) => {
  const parsed = SignupReqSchema.safeParse(req.body)
  if (!parsed.success) throw new ValidationError(...)
  
  const user = await userService.signup(parsed.data.email, parsed.data.password)
  issueSession(res, { userId: user.id })
  res.status(201).json(user)
})
```

**Responsibility**: HTTP request/response handling  
**Input**: Express Request  
**Output**: HTTP Response  
**Notes**: Wrapped with `asyncHandler()` for error catching

### 5. **Routes Layer** (Endpoint Definitions)
```typescript
// user.routes.ts
const router = Router()
router.post('/signup', signup)
router.get('/me', sessionAuth, me)
router.delete('/me', sessionAuth, deleteMe)

export default router
```

**Responsibility**: Route paths, middleware composition  
**Input**: Request objects  
**Output**: Response objects

## Data Flow Example: Creating a User

```
POST /secretLink/users/signup
│
├─ Express matches route → calls signup handler
│
├─ Controller: signup()
│  ├─ Parse & validate request body with SignupReqSchema
│  ├─ Call userService.signup(email, password)
│  │
│  ├─ Service: userService.signup()
│  │  ├─ Validate inputs
│  │  ├─ Call userStore.findByEmail(email) → check if exists
│  │  ├─ Hash password with Argon2
│  │  ├─ Call userStore.createUser(email, hash)
│  │  └─ Call userStore.getById(insertId) → return PublicUser
│  │
│  ├─ Store: userStore.createUser()
│  │  ├─ Get connection from pool
│  │  ├─ Execute INSERT INTO users
│  │  └─ Return { insertId }
│  │
│  ├─ Controller receives PublicUser
│  ├─ Issue session JWT
│  └─ Return 201 with user data
│
└─ Response sent to client with Set-Cookie header
```

## Authentication Flow

### Session Authentication (Browser)
```
1. User logs in → Password verified with Argon2
2. issueSession(res, { userId }) → JWT signed and sent in cookie
3. Subsequent requests → sessionAuth middleware validates JWT
4. req.session = { userId: X } attached to request
```

### PAT Authentication (API)
```
1. User creates token → generateLinkToken() → hashToken(SHA256)
2. Store token_hash in DB, return plain token once
3. API call: Authorization: Bearer <token>
4. authEither middleware → extract and verify token_hash
5. req.auth = { method: 'pat', userId: X, scopes: [...] }
```

### Combined authEither Middleware
```typescript
authEither (tries in order)
├─ Session cookie present?
│  └─ Validate JWT → attach req.session
├─ Bearer token present?
│  └─ Verify token_hash → attach req.auth
└─ Neither? → req.auth = null (unauthenticated)
```

## Error Handling

### Error Classes Hierarchy
```
Error
├─ AppError (statusCode, code, message)
│  ├─ ValidationError (400, VALIDATION_ERROR)
│  ├─ UnauthorizedError (401, UNAUTHORIZED)
│  ├─ ForbiddenError (403, FORBIDDEN)
│  └─ NotFoundError (404, NOT_FOUND)
└─ SyntaxError, etc. (caught by global handler)
```

### Error Flow
```
try {
  // Service logic
  throw new ValidationError("Email already in use")
} catch (err) {
  // Passed to asyncHandler's next()
}
→ Global errorHandler middleware
  ├─ If AppError → 400-500 response with code/message
  └─ If unknown Error → 500 response with message (dev only)
```

## Encryption Strategy

### Link Encryption (AES-256-GCM)

```typescript
encrypt(secret, itemId, linkToken, ownerId)
├─ Generate random 12-byte nonce
├─ Create AAD: "item_id:X|key_version:Y|link_token:Z|owner_user_id:W"
├─ Encrypt plaintext with AES-256-GCM
├─ Append authentication tag (16 bytes)
└─ Return { cipherText (base64url), nonce (base64url), aad }

// Storage
INSERT INTO links (cipher_text, nonce, key_version)
  VALUES (cipherText_bytes, nonce_bytes, keyVersion)

// Redemption
decrypt(cipherText_bytes, nonce_bytes, aad)
├─ Recreate cipher with same 12-byte nonce
├─ Verify AAD (tampering check)
├─ Split ciphertext and auth tag
├─ Decrypt and return plaintext
```

**Security Properties**:
- **Confidentiality**: AES-256 encrypts content
- **Authenticity**: GCM auth tag verifies no tampering
- **Integrity**: AAD includes link metadata (can't move to different owner)
- **Purging**: Ciphertext cleared after use or deletion

## Token Management

### API Token (PAT) Flow

```
createPAT(userId, label, scopes)
├─ Generate random 32-byte base64url token
├─ SHA256 hash it → store hash in DB
├─ Return plain token once (never stored)

// API call with token
Authorization: Bearer <plain_token>
├─ SHA256 hash received token
├─ Look up token_hash in DB
├─ Verify revoked_at IS NULL
├─ Extract user_id and scopes
└─ req.auth = { method: 'pat', userId, scopes }
```

**Why hash tokens?**
- If DB is compromised, tokens can't be used directly
- Token replay impossible without database access

## Transaction Management

Critical operations use database transactions:

```typescript
await withTx(async (cx) => {
  // Step 1: Lock and read
  const link = await store.linkByTokenForUpdate(cx, token)
  // Step 2: Decrypt and validate
  const secret = decrypt(link.cipher_text, ...)
  // Step 3: Purge and mark
  await store.setUsedAndPurge(cx, link.id)
  await store.deleteItemLock(cx, ...)
  await store.insertAudit(cx, ...)
  // Auto-commit on success, rollback on error
})
```

**Transaction Guarantee**: All changes atomically commit or none at all

## Logging Strategy

### HTTP Logging (pinoHttp)
- All requests/responses logged
- Sensitive headers redacted (auth, cookies, set-cookie)
- Custom serializers for request/response

### Context Logging
```typescript
const logger = getLogger('LinkService')
logger.info({ linkId, userId }, 'Link created')

// Output in context
{ context: 'LinkService', linkId: 123, userId: 456, msg: 'Link created' }
```

### Log Levels
- `trace`: Detailed execution flow
- `debug`: Authentication, token validation
- `info`: Important business events (link created, redeemed)
- `warn`: Recoverable errors (invalid credentials)
- `error`: Unrecoverable errors (DB connection lost)
- `fatal`: Application cannot start

## Testing Strategy

### Unit Tests (Services)
- Mock the store layer
- Test business logic in isolation
- Example: `user.service.test.ts`

```typescript
describe('UserService', () => {
  it('should hash password with Argon2', async () => {
    const user = await userService.signup('test@example.com', 'password123')
    expect(user.email).toBe('test@example.com')
  })
})
```

### Integration Tests (Controllers + API)
- Use real database (test database)
- Test full request/response flow
- Example: `user.controller.test.ts`

```typescript
it('POST /signup should create user and set session', async () => {
  const res = await request(app)
    .post('/secretLink/users/signup')
    .send({ email: 'test@example.com', password: 'password123' })
  
  expect(res.status).toBe(201)
  expect(res.body.id).toBeDefined()
  expect(res.headers['set-cookie'][0]).toContain('sid=')
})
```

## Deployment Considerations

### Environment-Specific Config
```typescript
if (NODE_ENV === 'production') {
  // Stricter validation
  // Secure cookie flags enabled
  // Pretty logging disabled
}
```

### Database Migrations
- Schema should exist before app starts
- Use `MASTER_KEY_V1` generated at deployment time
- Use separate `SESSION_SECRET` per deployment

### Health Checks
```
GET /health → { status: 'ok', timestamp: '...' }
```

### Monitoring
- Log aggregation (send Pino output to Cloudflare/ELK/Datadog)
- Database connection pool monitoring
- Error rate alerting

## Future Enhancements

1. **Rate Limiting**: Integrate express-rate-limit middleware
2. **Request Tracing**: Add traceId to all logs for debugging
3. **Database Connection Retry**: Implement exponential backoff
4. **Cache Layer**: Redis for token validation and session storage
5. **TypeScript Validation**: Add runtime type guards for API responses
6. **Audit Logging**: Track IP address and user agent
7. **Email Notifications**: Send alerts for account changes
8. **Feature Flags**: Runtime feature toggles
9. **Metrics**: Prometheus for request latency, DB query times
10. **GraphQL**: Consider GraphQL layer for flexible querying

## Adding a New Endpoint

1. **Define Schema**
   ```typescript
   // myfeature.schema.ts
   export const MyRequestSchema = z.object({ ... })
   ```

2. **Implement Store**
   ```typescript
   // myfeature.store.ts
   async doSomething(): Promise<MyData>
   ```

3. **Add Service Logic**
   ```typescript
   // myfeature.service.ts
   async handleRequest(): Promise<Result>
   ```

4. **Create Controller**
   ```typescript
   // myfeature.controller.ts
   export const myHandler = asyncHandler(async (req, res) => { ... })
   ```

5. **Register Route**
   ```typescript
   // myfeature.routes.ts
   router.post('/my-endpoint', authMiddleware, myHandler)
   ```

6. **Mount in App**
   ```typescript
   // app.ts
   app.use('/myfeature', myRouter)
   ```

---

For questions or improvements, see the main README.md
