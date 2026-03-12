# Architecture Design: 7-Service Partition

Based on the proposed partitioning: [Auth](file:///e:/CINEMAKATOK25-SERVER/src/auth/auth.module.ts#26-57), `Analytic`, `AuditLog`, `Content`, `User`, `User-Activity`, and `Streaming`.

To avoid deployment nightmares while solving the tight coupling issue, we will adopt a **Logical Database Partitioning (Schema-per-Service)** strategy within a single shared PostgreSQL instance for relational data, while utilizing NoSQL/Cache for high-throughput services.

## Service & Database Mapping

### 1. Auth Service
- **Role:** Handles Login, JWT issuance, OAuth2, Password Reset, Email Verification.
- **Data:** Credentials, Refresh Tokens, OTPs.
- **Database Partition:** PostgreSQL Schema -> `auth_schema`
  - High security, strict access. Read-heavy during authentication, write on login/refresh.

### 2. User Service
- **Role:** Manages User Profiles, Preferences, Roles, and Account details.
- **Data:** User Profiles, Settings.
- **Database Partition:** PostgreSQL Schema -> `user_schema`
  - *Note:* Auth and User are often combined. Splitting them means [Auth](file:///e:/CINEMAKATOK25-SERVER/src/auth/auth.module.ts#26-57) issues tokens with a `userId`, and the `User` service fetches the profile using that `userId`.

### 3. Content Service (CMS)
- **Role:** Manages Movies, TV Series, Episodes, Actors, Directors, Categories, Tags.
- **Data:** Core entertainment metadata.
- **Database Partition:** PostgreSQL Schema -> `content_schema`
  - Heavy relational data. Requires complex joins (e.g., finding all movies by a specific actor in a specific category).

### 4. Streaming Service
- **Role:** Video Processing, S3 presigned URLs, HLS manifest delivery.
- **Data:** Video metadata, upload status, queue management.
- **Database Partition:** **None / Redis**
  - Should be completely stateless for rapid scaling. Relies on Redis (BullMQ) for queue management and AWS S3/Cloudflare R2 for binary storage.

### 5. User-Activity Service (PEP)
- **Role:** Watch progress, Favorites, Watchlist, Reviews, Ratings.
- **Data:** User interactions with Content.
- **Database Partition:** PostgreSQL Schema -> `activity_schema`
  - Originally highly coupled to Content. By splitting it, this service stores mappings like [(userId, contentId, progress)](file:///e:/CINEMAKATOK25-SERVER/src/pep/pep.module.ts#31-76). It will query the Content Service via gRPC/TCP to get movie details, achieving decoupling.

### 6. AuditLog Service
- **Role:** Tracks system-wide events (e.g., "User X updated Movie Y", "Admin logged in").
- **Data:** Immutable event logs.
- **Database Partition:** **MongoDB** or **Elasticsearch** (Recommended over PostgreSQL)
  - Append-only, high write volume, document-oriented structure. Does not need relational integrity.

### 7. Analytic Service
- **Role:** Generates trending data, view counts, reports, and dashboards.
- **Data:** Aggregated metrics.
- **Database Partition:** **Redis (for real-time counters)** + **PostgreSQL/Clickhouse** (for batch aggregates).
  - Listens to events from User-Activity and AuditLog to build fast-read views (e.g., Top 10 Movies today).

---

## Why "Schema-per-Service" instead of completely separate physical databases?

By using different *Schemas* inside the same physical PostgreSQL Database (for Auth, User, Content, and Activity):
1. **Deployment is Simple:** You only manage one database server in production.
2. **Isolation is enforced:** Each service gets its own independent database user and schema (`content_user` can only read `content_schema`). This acts as a strict boundary, preventing spaghetti code.
3. **Migration remains possible:** If `content_schema` gets too massive, you can easily physically extract it to a dedicated Postgres server later without changing the application code.

## Communication Pattern
Services will communicate asynchronously via **Redis Pub/Sub** or **Message Broker (RabbitMQ/Kafka)** for events (e.g., `User X watched Video Y`), and synchronously via **gRPC or TCP (NestJS Microservices)** for direct data requests.
