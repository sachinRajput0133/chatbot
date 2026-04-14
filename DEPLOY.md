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

## Updating

```bash
git pull
docker compose build api web
docker compose up -d --no-deps api web
```

Migrations run automatically on `api` restart.

---

## Logs & monitoring

```bash
docker compose logs -f          # all services
docker compose logs -f api      # API only
docker compose ps               # health status
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
