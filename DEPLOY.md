# Production Deployment Guide

## Prerequisites

- Ubuntu 22.04 server (2 vCPU / 4 GB RAM minimum)
- Docker + Docker Compose installed
- A domain name pointed at the server
- SSL certificate (Let's Encrypt recommended)

---

## 1. Get SSL certificates (Let's Encrypt)

```bash
sudo apt install certbot
sudo certbot certonly --standalone -d yourdomain.com
# Certs land at: /etc/letsencrypt/live/yourdomain.com/
sudo cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem nginx/ssl/
sudo cp /etc/letsencrypt/live/yourdomain.com/privkey.pem   nginx/ssl/
```

Add a cron job to auto-renew and copy:
```bash
0 3 * * * certbot renew --quiet && \
  cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem /path/to/chatbot/nginx/ssl/ && \
  cp /etc/letsencrypt/live/yourdomain.com/privkey.pem   /path/to/chatbot/nginx/ssl/ && \
  docker compose exec nginx nginx -s reload
```

---

## 2. Configure environment

```bash
cp .env.production.example .env
```

Edit `.env` and fill in **every** value. Critical ones:

| Variable | Action |
|---|---|
| `JWT_SECRET_KEY` | `python3 -c "import secrets; print(secrets.token_hex(32))"` |
| `POSTGRES_PASSWORD` | Choose a strong password |
| `DATABASE_URL` | Update to match POSTGRES_PASSWORD |
| `APP_URL` | `https://api.yourdomain.com` (or `https://yourdomain.com`) |
| `FRONTEND_URL` | `https://yourdomain.com` |
| `CORS_ORIGINS` | `https://yourdomain.com` |
| `NEXT_PUBLIC_API_URL` | `https://yourdomain.com` |
| `GOOGLE_CLIENT_ID` | Add `https://yourdomain.com` to Authorized JS Origins |
| `STRIPE_SECRET_KEY` | Use `sk_live_...` not `sk_test_...` |
| `RAZORPAY_KEY_ID` | Use `rzp_live_...` not `rzp_test_...` |

---

## 3. Update nginx.conf with your domain

Edit [nginx/nginx.conf](nginx/nginx.conf) and replace `server_name _;` with:
```nginx
server_name yourdomain.com www.yourdomain.com;
```

---

## 4. Build and start

```bash
# Build the widget first
cd apps/widget && npm install && npm run build && cd ../..

# Build and start all services
docker compose build
docker compose up -d

# Watch logs
docker compose logs -f api
```

Alembic migrations run automatically when the `api` container starts.

---

## 5. Verify

```bash
curl https://yourdomain.com/health        # → {"status": "ok"}
curl https://yourdomain.com/widget/widget.js  # → JS bundle
```

---

## Updating (after code changes)

```bash
git pull

# Rebuild only API (Python code changed)
docker compose build api && docker compose up -d --no-deps api

# Rebuild only Web (Next.js code changed)
docker compose build web && docker compose up -d --no-deps web

# Rebuild both API + Web
docker compose build api web && docker compose up -d --no-deps api web

# Rebuild everything from scratch (no cache)
docker compose build --no-cache && docker compose up -d
```

Migrations run automatically on `api` restart.

---

## Build commands reference

### First-time / full deploy
```bash
# 1. Build widget JS (must do before docker build)
cd apps/widget && npm install && npm run build && cd ../..

# 2. Build all Docker images
docker compose build

# 3. Start everything
docker compose up -d

# 4. Check all containers are running
docker compose ps
```

### Rebuild single service (no cache)
```bash
docker compose build --no-cache api     # API image from scratch
docker compose build --no-cache web     # Web image from scratch (re-bakes NEXT_PUBLIC_* vars)
docker compose build --no-cache nginx   # Nginx image from scratch
```

### Apply changes without full restart
```bash
docker compose up -d --no-deps api      # restart API only, keep others running
docker compose up -d --no-deps web      # restart Web only
docker compose restart api              # quick restart (no rebuild)
docker compose restart nginx            # reload nginx config
```

### Stop / remove
```bash
docker compose down                     # stop all, keep volumes
docker compose down -v                  # stop all + delete DB/Redis data (DESTRUCTIVE)
```

> **Note:** `NEXT_PUBLIC_*` variables are baked into the Next.js image at build time.
> Any time you change `NEXT_PUBLIC_API_URL` or `NEXT_PUBLIC_GOOGLE_CLIENT_ID` in `.env`,
> you MUST rebuild the web image: `docker compose build --no-cache web && docker compose up -d --no-deps web`

---

## Logs & monitoring

### Real-time logs (follow mode)
```bash
docker compose logs -f                   # all services, live stream
docker compose logs -f api               # API only
docker compose logs -f web               # Next.js frontend
docker compose logs -f nginx             # Nginx (access + errors)
docker compose logs -f db                # PostgreSQL
docker compose logs -f redis             # Redis
docker compose logs -f api web           # multiple services at once
```

### Last N lines (no follow)
```bash
docker compose logs --tail=100 api       # last 100 lines from API
docker compose logs --tail=50 nginx      # last 50 lines from Nginx
docker compose logs --tail=200           # last 200 lines from all services
```

### Since a time / timestamps
```bash
docker compose logs --since 10m api      # logs from last 10 minutes
docker compose logs --since 1h           # logs from last 1 hour
docker compose logs -t api               # include timestamps
docker compose logs -t --tail=50 api     # timestamps + last 50 lines
```

### Container status
```bash
docker compose ps                        # show all containers + health
docker stats                             # live CPU/memory per container
```

### One-liner to check if a service is crashing
```bash
docker compose ps api                    # look for "Restarting" status
docker compose logs --tail=30 api        # see why it crashed
```

---

## Useful commands

```bash
# Run a one-off migration manually
docker compose exec api alembic upgrade head

# Open a DB shell
docker compose exec db psql -U chatbot -d chatbot_db

# Restart a single service
docker compose restart api
```
