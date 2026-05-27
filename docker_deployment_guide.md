# Docker & Docker Compose Deployment Guide

This guide describes how to build, run, and scale the NestJS monorepos for **CinemaKatoK** using the optimized Docker setup created.

## 📁 Created Files

1. **[Dockerfile](file:///e:/KLTN/CINEMAKATOK26-SERVER/Dockerfile)**: Multi-stage build that:
   - Uses `google/shaka-packager:latest` to pull the Linux-compatible Shaka Packager binary (~5MB).
   - Uses `node:20-alpine` as the base image for runtime to reduce size and minimize security vulnerabilities.
   - Leverages `pnpm` workspace caching.
   - Compiles all microservices into the `dist/apps/` output.
   - Employs non-root user `nestjs:nodejs` for security hardening.
   - Dynamically selects which microservice to launch at runtime via the `SERVICE_NAME` environment variable.
2. **[.dockerignore](file:///e:/KLTN/CINEMAKATOK26-SERVER/.dockerignore)**: Excludes local node modules, build files, secret environment variables, and the Windows-only `.exe` binary to speed up the Docker context transfer and protect secrets.
3. **[db/init.sql](file:///e:/KLTN/CINEMAKATOK26-SERVER/db/init.sql)**: Automatically creates databases for all independent microservices on the PostgreSQL container's first startup.
4. **[docker-compose.yml](file:///e:/KLTN/CINEMAKATOK26-SERVER/docker-compose.yml)**: Orchestrates the 12 microservices alongside Postgres, Redis, and RabbitMQ container dependencies.

---

## 🚀 How to Run the Stack

### Prerequisites
- Install [Docker Desktop](https://www.docker.com/products/docker-desktop/) (Windows/macOS) or Docker Engine (Linux).
- Make sure **Docker Desktop is open and running** before running any docker commands.
- Docker Compose should be installed (`docker compose version` check).

### ⚡ Start Services WITHOUT Rebuilding (Recommended for daily run)
If you have already built the Docker images once and haven't modified the source code, run:
```bash
docker compose up -d
```
This starts the existing container images instantly in the background without wasting time rebuilding them.

### 🔄 Build & Start Services (When code changes)
Run this when you have modified service code or configuration files:
```bash
docker compose up --build -d
```

### 🛑 Stop Services
* **Stop and keep containers (Fast Stop/Start)**:
  ```bash
  docker compose stop
  ```
  *To start them back up instantly:* `docker compose start`
* **Stop and remove containers (Full Cleanup)**:
  ```bash
  docker compose down
  ```

### 🔍 Verify Container Health & Logs
* Check if all services and databases are running:
  ```bash
  docker compose ps
  ```
* View live logs of any specific service (e.g. streaming service):
  ```bash
  docker compose logs -f streaming-service
  ```

---

## ❌ Troubleshooting

### Error: `open //./pipe/dockerDesktopLinuxEngine: The system cannot find the file specified`
This error means the **Docker Desktop application is not running** or is currently starting up.
* **Solution**: Search for "Docker Desktop" in your Windows Start Menu, open it, and wait for the status indicator at the bottom-left to turn **green (running)**. Once it is running, retry your `docker compose` commands.

---

## ⚙️ Service Architecture & Networking

All containers are connected via a bridge network named `cinemakatok-network`. Microservices communicate using **NestJS TCP Transport** on their internal ports.

| Container Name | Service Role | Port (Host:Container) | Service Name ENV |
| :--- | :--- | :--- | :--- |
| `cinemakatok-postgres` | PostgreSQL Database | `5432:5432` | N/A |
| `cinemakatok-redis` | Redis Cache / BullMQ | `6379:6379` | N/A |
| `cinemakatok-rabbitmq` | RabbitMQ Message Broker | `5672:5672`, `15672:15672` | N/A |
| `cinemakatok-api-gateway` | HTTP Public Entrypoint | `3000:3000` | `api-gateway` |
| `cinemakatok-auth-service` | TCP Microservice | `3001:3001` | `auth-service` |
| `cinemakatok-user-service` | TCP Microservice | `3002:3002` | `user-service` |
| `cinemakatok-content-service` | TCP Microservice | `3003:3003` | `content-service` |
| `cinemakatok-order-service` | TCP Microservice | `3004:3004` | `order-service` |
| `cinemakatok-payment-service` | TCP Microservice | `3005:3005` | `payment-service` |
| `cinemakatok-streaming-service`| TCP Microservice & Shaka Packager| `3006:3006` | `streaming-service` |
| `cinemakatok-notification-service`| TCP Microservice | `3007:3007` | `notification-service` |
| `cinemakatok-audit-log-service`| TCP Microservice | `3008:3008` | `audit-log-service` |
| `cinemakatok-analytics-service`| TCP Microservice | `3009:3009` | `analytics-service` |
| `cinemakatok-user-activity-service`| TCP Microservice | `3010:3010` | `user-activity-service` |
| `cinemakatok-watch-party-service`| TCP Microservice | `3011:3011` | `watch-party-service` |

---

## 🛠️ Optimizations Applied

* **Resource Limits**: Memory constraints (`deploy.resources.limits.memory`) have been added to prevent local development environments from choking when executing 15 concurrent containers.
* **Health Checks**: Containers wait for database and broker readiness (`depends_on` + `condition: service_healthy`) before launching to avoid boot-up connection retries and crash loops.
* **Shaka Packager Support**: Automatically provisions Linux `packager` binary into the streaming service so it works natively.
* **Non-Root Execution**: Runs under the customized `nestjs` user instead of standard `root` to mitigate potential container breakouts.
