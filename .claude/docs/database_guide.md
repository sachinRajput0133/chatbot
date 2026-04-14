# Database Guide

**Engine**: PostgreSQL + SQLAlchemy async (asyncpg driver) + pgvector extension
**Connection**: `DATABASE_URL=postgresql+asyncpg://chatbot:chatbot_secret@localhost:5433/chatbot_db`
**Schema management**: Alembic migrations (`alembic upgrade head`)

---

## Tables

### `tenants`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| business_name | str | |
| email | str unique | |
| bot_id | UUID unique | embed identifier — used in widget + chat endpoint |
| plan | enum | free / starter / growth / enterprise |
| stripe_customer_id | str | nullable |
| stripe_subscription_id | str | nullable |
| razorpay_customer_id | str | nullable |
| razorpay_subscription_id | str | nullable |
| message_count_month | int | reset monthly, enforced at chat endpoint |
| is_active | bool | |
| created_at | datetime | |

### `users`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| tenant_id | FK tenants | |
| email | str unique | |
| password_hash | str | nullable (Google OAuth users) |
| google_id | str | nullable |
| role | enum | owner / staff |

### `knowledge_documents`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| tenant_id | FK | |
| filename | str | |
| file_type | enum | pdf / txt / docx / manual |
| status | enum | pending → processing → indexed / failed |
| chunk_count | int | |
| error_message | str | set on failure |

### `knowledge_chunks`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| document_id | FK | |
| tenant_id | FK | for fast pgvector search |
| content | text | chunk text |
| embedding | vector(1536) | pgvector — cosine similarity search |
| metadata | JSON | page number, position |

### `widget_configs`
| Column | Type | Notes |
|--------|------|-------|
| tenant_id | FK unique | one per tenant |
| bot_name | str | default "Assistant" |
| primary_color | str | hex, default #6366f1 |
| welcome_message | str | |
| position | enum | bottom-right / bottom-left |
| avatar_url | str | nullable |

### `web_conversations`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| tenant_id | FK | |
| visitor_id | str | UUID from localStorage |
| page_url | str | page where chat started |
| started_at | datetime | |
| last_message_at | datetime | |

### `web_messages`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| conversation_id | FK | |
| role | enum | user / assistant |
| content | text | |
| tokens_used | int | |
| created_at | datetime | |

### `subscriptions`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| tenant_id | FK | |
| gateway | str | stripe / razorpay |
| plan | enum | |
| status | str | active / cancelled / past_due |
| current_period_end | datetime | |

---

## Common Queries (psql)

```bash
# Connect
PGPASSWORD=chatbot_secret psql -h localhost -p 5433 -U chatbot -d chatbot_db

# List tenants + plans
SELECT business_name, plan, message_count_month, bot_id FROM tenants;

# Check platform admin
SELECT business_name, email, plan FROM tenants WHERE email = 'admin@chatbot.platform';

# Check knowledge documents
SELECT filename, status, chunk_count FROM knowledge_documents ORDER BY created_at DESC;

# Count chunks per tenant
SELECT t.business_name, count(kc.id) as chunks
FROM knowledge_chunks kc JOIN tenants t ON t.id = kc.tenant_id
GROUP BY t.business_name;

# Check conversations
SELECT v.visitor_id, count(m.id) as messages, v.page_url
FROM web_conversations v JOIN web_messages m ON m.conversation_id = v.id
GROUP BY v.id ORDER BY count(m.id) DESC LIMIT 20;

# Reset message count (for testing)
UPDATE tenants SET message_count_month = 0 WHERE email = 'test@co.com';
```
