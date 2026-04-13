# Graph Report - .  (2026-04-13)

## Corpus Check
- 90 files · ~39,968 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 437 nodes · 733 edges · 67 communities detected
- Extraction: 68% EXTRACTED · 32% INFERRED · 0% AMBIGUOUS · INFERRED: 235 edges (avg confidence: 0.5)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Community 32|Community 32]]
- [[_COMMUNITY_Community 33|Community 33]]
- [[_COMMUNITY_Community 34|Community 34]]
- [[_COMMUNITY_Community 35|Community 35]]
- [[_COMMUNITY_Community 36|Community 36]]
- [[_COMMUNITY_Community 37|Community 37]]
- [[_COMMUNITY_Community 38|Community 38]]
- [[_COMMUNITY_Community 39|Community 39]]
- [[_COMMUNITY_Community 40|Community 40]]
- [[_COMMUNITY_Community 41|Community 41]]
- [[_COMMUNITY_Community 42|Community 42]]
- [[_COMMUNITY_Community 43|Community 43]]
- [[_COMMUNITY_Community 44|Community 44]]
- [[_COMMUNITY_Community 45|Community 45]]
- [[_COMMUNITY_Community 46|Community 46]]
- [[_COMMUNITY_Community 47|Community 47]]
- [[_COMMUNITY_Community 48|Community 48]]
- [[_COMMUNITY_Community 49|Community 49]]
- [[_COMMUNITY_Community 50|Community 50]]
- [[_COMMUNITY_Community 51|Community 51]]
- [[_COMMUNITY_Community 52|Community 52]]
- [[_COMMUNITY_Community 53|Community 53]]
- [[_COMMUNITY_Community 54|Community 54]]
- [[_COMMUNITY_Community 55|Community 55]]
- [[_COMMUNITY_Community 56|Community 56]]
- [[_COMMUNITY_Community 57|Community 57]]
- [[_COMMUNITY_Community 58|Community 58]]
- [[_COMMUNITY_Community 59|Community 59]]
- [[_COMMUNITY_Community 60|Community 60]]
- [[_COMMUNITY_Community 61|Community 61]]
- [[_COMMUNITY_Community 62|Community 62]]
- [[_COMMUNITY_Community 63|Community 63]]
- [[_COMMUNITY_Community 64|Community 64]]
- [[_COMMUNITY_Community 65|Community 65]]
- [[_COMMUNITY_Community 66|Community 66]]

## God Nodes (most connected - your core abstractions)
1. `Tenant` - 23 edges
2. `MessageRole` - 21 edges
3. `WebConversation` - 21 edges
4. `Base` - 19 edges
5. `WebMessage` - 19 edges
6. `DocumentType` - 19 edges
7. `DocumentStatus` - 19 edges
8. `Plan` - 15 edges
9. `WidgetConfig` - 12 edges
10. `auth_service.py — Authentication business logic.  Google ID token verification u` - 11 edges

## Surprising Connections (you probably didn't know these)
- `WebSocket endpoint for real-time widget updates via Redis Pub/Sub.     The widge` --uses--> `WebConversation`  [INFERRED]
  apps/api/app/routers/ws.py → apps/api/app/models/conversation.py
- `WebSocket endpoint for real-time dashboard updates.     The dashboard connects h` --uses--> `WebConversation`  [INFERRED]
  apps/api/app/routers/ws.py → apps/api/app/models/conversation.py
- `Public endpoint — returns the platform help bot_id for the dashboard help widget` --uses--> `Tenant`  [INFERRED]
  apps/api/app/routers/platform.py → apps/api/app/models/tenant.py
- `Auto-create the platform admin tenant on first startup.` --uses--> `Tenant`  [INFERRED]
  apps/api/app/main.py → apps/api/app/models/tenant.py
- `Auto-create the platform admin tenant on first startup.` --uses--> `WidgetConfig`  [INFERRED]
  apps/api/app/main.py → apps/api/app/models/widget.py

## Communities

### Community 0 - "Community 0"
Cohesion: 0.13
Nodes (40): Base, chat(), ChatRequest, ChatResponse, ContactRequest, ContactResponse, get_chat_history(), HistoryMessage (+32 more)

### Community 1 - "Community 1"
Cohesion: 0.11
Nodes (31): _download_from_s3(), _embed_texts(), _extract_text(), _fetch_url_text(), process_document(), _process_document_async(), Celery worker: processes uploaded documents into vector embeddings., Celery task: extract → chunk → embed a knowledge document. (+23 more)

### Community 2 - "Community 2"
Cohesion: 0.09
Nodes (29): AnalyticsSummary, get_summary(), ChangePasswordRequest, Config, GoogleAuthRequest, LoginRequest, MeResponse, _get_google_user_info() (+21 more)

### Community 3 - "Community 3"
Cohesion: 0.11
Nodes (15): BaseSettings, Config, Settings, init_db(), Initialize pgvector extension., append_conversation_message(), clear_conversation_history(), get_conversation_history() (+7 more)

### Community 4 - "Community 4"
Cohesion: 0.18
Nodes (16): Dual-gateway billing service. India → Razorpay  |  International → Stripe, Cancel at period end — user keeps access until current period expires,     no au, Called immediately after checkout.js handler fires.     Verifies the Razorpay pa, Returns a dict with gateway info.      Stripe:   {"gateway": "stripe",   "checko, Base, DeclarativeBase, lifespan(), Auto-create the platform admin tenant on first startup. (+8 more)

### Community 5 - "Community 5"
Cohesion: 0.16
Nodes (10): appendMessage(), buildLeadForm(), buildWidget(), escHtml(), fetchConfig(), init(), injectStyles(), isLeadSubmitted() (+2 more)

### Community 6 - "Community 6"
Cohesion: 0.18
Nodes (10): B(), F(), I(), j(), k(), N(), O(), q() (+2 more)

### Community 7 - "Community 7"
Cohesion: 0.25
Nodes (12): cancel_subscription(), create_checkout(), _get_razorpay_client(), handle_stripe_webhook(), _on_stripe_sub_cancelled(), _on_stripe_sub_created(), _on_stripe_sub_updated(), _razorpay_checkout() (+4 more)

### Community 8 - "Community 8"
Cohesion: 0.24
Nodes (9): _build_lead_capture_info(), Config, get_widget_config_public(), LeadCaptureInfo, Public endpoint — used by widget.js to load bot appearance., Lead capture config embedded in widget-config response (public endpoint)., WidgetConfigOut, WidgetConfigUpdate (+1 more)

### Community 9 - "Community 9"
Cohesion: 0.29
Nodes (10): _base(), Email service using Resend. All sends are fire-and-forget — errors are logged bu, Sent when a user upgrades to a paid plan., Send an email. Silently logs on failure so it never breaks the caller., Sent when a subscription is cancelled., Welcome email sent immediately after signup., _send(), send_plan_cancelled() (+2 more)

### Community 10 - "Community 10"
Cohesion: 0.38
Nodes (9): add_faq_knowledge(), add_manual_knowledge(), crawl_url(), delete_document(), get_document_content(), _get_tenant(), list_documents(), update_manual_document() (+1 more)

### Community 11 - "Community 11"
Cohesion: 0.27
Nodes (8): LeadCaptureConfig, build_lead_collection_prompt(), extract_contact_info(), get_config(), Lead capture service: get/upsert config, build system prompt addon, extract cont, Return a system prompt addon that instructs the bot to collect contact info., Extract name, email, phone from a message using simple regex patterns., upsert_config()

### Community 12 - "Community 12"
Cohesion: 0.38
Nodes (9): _active_provider(), _build_system_prompt(), _call_ai(), _embed_query(), _get_or_create_conversation(), handle_chat(), Returns embedding vector or None if no OpenAI key (falls back to keyword search), _rephrase_query() (+1 more)

### Community 13 - "Community 13"
Cohesion: 0.39
Nodes (6): completeGoogleSignup(), handleEmailSignup(), handleGoogleSuccess(), handleSubmit(), parseToken(), triggerGoogleLogin()

### Community 14 - "Community 14"
Cohesion: 0.29
Nodes (2): field(), handleSave()

### Community 15 - "Community 15"
Cohesion: 0.33
Nodes (3): ApiError, getToken(), request()

### Community 16 - "Community 16"
Cohesion: 0.29
Nodes (0): 

### Community 17 - "Community 17"
Cohesion: 0.52
Nodes (5): getVisitorId(), send(), startChat(), storeConvId(), submitForm()

### Community 18 - "Community 18"
Cohesion: 0.29
Nodes (0): 

### Community 19 - "Community 19"
Cohesion: 0.29
Nodes (0): 

### Community 20 - "Community 20"
Cohesion: 0.47
Nodes (4): confirmCancel(), handleUpgrade(), loadData(), loadRazorpayScript()

### Community 21 - "Community 21"
Cohesion: 0.4
Nodes (4): WebSocket endpoint for real-time widget updates via Redis Pub/Sub.     The widge, WebSocket endpoint for real-time dashboard updates.     The dashboard connects h, tenant_dashboard_websocket(), websocket_chat_endpoint()

### Community 22 - "Community 22"
Cohesion: 0.5
Nodes (2): run_async_migrations(), run_migrations_online()

### Community 23 - "Community 23"
Cohesion: 0.5
Nodes (0): 

### Community 24 - "Community 24"
Cohesion: 0.5
Nodes (0): 

### Community 25 - "Community 25"
Cohesion: 0.83
Nodes (3): get_lead_config(), _get_tenant(), update_lead_config()

### Community 26 - "Community 26"
Cohesion: 0.5
Nodes (3): Serve widget.js — the embeddable chat bubble script., Single widget.js served to all clients.     Reads window.ChatbotConfig.botId to, serve_widget()

### Community 27 - "Community 27"
Cohesion: 0.5
Nodes (1): add visitor identity to conversations  Revision ID: a1b2c3d4e5f6 Revises: 4f798f

### Community 28 - "Community 28"
Cohesion: 0.5
Nodes (1): add visitor_address to web_conversations  Revision ID: g2h3i4j5k6l7 Revises: f1a

### Community 29 - "Community 29"
Cohesion: 0.5
Nodes (1): add lead_capture_configs table  Revision ID: e6f7a8b9c0d1 Revises: d5e6f7a8b9c0

### Community 30 - "Community 30"
Cohesion: 0.5
Nodes (1): initial  Revision ID: 4f798f3a959e Revises:  Create Date: 2026-03-23 01:10:55.27

### Community 31 - "Community 31"
Cohesion: 0.5
Nodes (1): add cancel_at_period_end to subscriptions  Revision ID: b3c4d5e6f7a8 Revises: a1

### Community 32 - "Community 32"
Cohesion: 0.5
Nodes (1): add human takeover: mode column and agent message role  Revision ID: f1a2b3c4d5e

### Community 33 - "Community 33"
Cohesion: 0.5
Nodes (1): add brand voice fields to widget_configs  Revision ID: c4d5e6f7a8b9 Revises: b3c

### Community 34 - "Community 34"
Cohesion: 0.5
Nodes (1): add faq and url to document type enum  Revision ID: d5e6f7a8b9c0 Revises: c4d5e6

### Community 35 - "Community 35"
Cohesion: 0.67
Nodes (0): 

### Community 36 - "Community 36"
Cohesion: 0.67
Nodes (0): 

### Community 37 - "Community 37"
Cohesion: 0.67
Nodes (0): 

### Community 38 - "Community 38"
Cohesion: 0.67
Nodes (2): platform_config(), Public endpoint — returns the platform help bot_id for the dashboard help widget

### Community 39 - "Community 39"
Cohesion: 1.0
Nodes (0): 

### Community 40 - "Community 40"
Cohesion: 1.0
Nodes (0): 

### Community 41 - "Community 41"
Cohesion: 1.0
Nodes (0): 

### Community 42 - "Community 42"
Cohesion: 1.0
Nodes (0): 

### Community 43 - "Community 43"
Cohesion: 1.0
Nodes (0): 

### Community 44 - "Community 44"
Cohesion: 1.0
Nodes (0): 

### Community 45 - "Community 45"
Cohesion: 1.0
Nodes (0): 

### Community 46 - "Community 46"
Cohesion: 1.0
Nodes (0): 

### Community 47 - "Community 47"
Cohesion: 1.0
Nodes (0): 

### Community 48 - "Community 48"
Cohesion: 1.0
Nodes (0): 

### Community 49 - "Community 49"
Cohesion: 1.0
Nodes (0): 

### Community 50 - "Community 50"
Cohesion: 1.0
Nodes (0): 

### Community 51 - "Community 51"
Cohesion: 1.0
Nodes (0): 

### Community 52 - "Community 52"
Cohesion: 1.0
Nodes (0): 

### Community 53 - "Community 53"
Cohesion: 1.0
Nodes (0): 

### Community 54 - "Community 54"
Cohesion: 1.0
Nodes (0): 

### Community 55 - "Community 55"
Cohesion: 1.0
Nodes (0): 

### Community 56 - "Community 56"
Cohesion: 1.0
Nodes (0): 

### Community 57 - "Community 57"
Cohesion: 1.0
Nodes (0): 

### Community 58 - "Community 58"
Cohesion: 1.0
Nodes (0): 

### Community 59 - "Community 59"
Cohesion: 1.0
Nodes (0): 

### Community 60 - "Community 60"
Cohesion: 1.0
Nodes (0): 

### Community 61 - "Community 61"
Cohesion: 1.0
Nodes (0): 

### Community 62 - "Community 62"
Cohesion: 1.0
Nodes (0): 

### Community 63 - "Community 63"
Cohesion: 1.0
Nodes (0): 

### Community 64 - "Community 64"
Cohesion: 1.0
Nodes (0): 

### Community 65 - "Community 65"
Cohesion: 1.0
Nodes (0): 

### Community 66 - "Community 66"
Cohesion: 1.0
Nodes (0): 

## Knowledge Gaps
- **24 isolated node(s):** `Serve widget.js — the embeddable chat bubble script.`, `Single widget.js served to all clients.     Reads window.ChatbotConfig.botId to`, `Returns embedding vector or None if no OpenAI key (falls back to keyword search)`, `Email service using Resend. All sends are fire-and-forget — errors are logged bu`, `Send an email. Silently logs on failure so it never breaks the caller.` (+19 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Community 39`** (2 nodes): `page.tsx`, `LandingPage()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 40`** (2 nodes): `providers.tsx`, `Providers()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 41`** (2 nodes): `layout.tsx`, `RootLayout()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 42`** (2 nodes): `layout.tsx`, `logout()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 43`** (2 nodes): `GoogleOAuthProviderWrapper.tsx`, `GoogleOAuthProviderWrapper()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 44`** (2 nodes): `ChatbotWidget.tsx`, `ChatbotWidget()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 45`** (1 nodes): `tailwind.config.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 46`** (1 nodes): `next-env.d.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 47`** (1 nodes): `next.config.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 48`** (1 nodes): `postcss.config.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 49`** (1 nodes): `store.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 50`** (1 nodes): `authApi.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 51`** (1 nodes): `conversationsApi.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 52`** (1 nodes): `index.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 53`** (1 nodes): `analyticsApi.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 54`** (1 nodes): `baseApi.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 55`** (1 nodes): `billingApi.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 56`** (1 nodes): `widgetApi.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 57`** (1 nodes): `knowledgeApi.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 58`** (1 nodes): `page.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 59`** (1 nodes): `page.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 60`** (1 nodes): `__init__.py`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 61`** (1 nodes): `__init__.py`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 62`** (1 nodes): `__init__.py`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 63`** (1 nodes): `__init__.py`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 64`** (1 nodes): `__init__.py`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 65`** (1 nodes): `__init__.py`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 66`** (1 nodes): `celery_app.py`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Base` connect `Community 4` to `Community 0`, `Community 1`, `Community 3`, `Community 8`, `Community 11`?**
  _High betweenness centrality (0.100) - this node is a cross-community bridge._
- **Why does `Tenant` connect `Community 0` to `Community 8`, `Community 2`, `Community 4`, `Community 38`?**
  _High betweenness centrality (0.048) - this node is a cross-community bridge._
- **Why does `WebConversation` connect `Community 0` to `Community 2`, `Community 4`, `Community 21`?**
  _High betweenness centrality (0.027) - this node is a cross-community bridge._
- **Are the 21 inferred relationships involving `Tenant` (e.g. with `Auto-create the platform admin tenant on first startup.` and `ContactRequest`) actually correct?**
  _`Tenant` has 21 INFERRED edges - model-reasoned connections that need verification._
- **Are the 19 inferred relationships involving `MessageRole` (e.g. with `Cursor-based paginated messages.      - First load: omit `before` → returns the` and `Toggle a conversation between AI and human mode.`) actually correct?**
  _`MessageRole` has 19 INFERRED edges - model-reasoned connections that need verification._
- **Are the 19 inferred relationships involving `WebConversation` (e.g. with `Cursor-based paginated messages.      - First load: omit `before` → returns the` and `Toggle a conversation between AI and human mode.`) actually correct?**
  _`WebConversation` has 19 INFERRED edges - model-reasoned connections that need verification._
- **Are the 17 inferred relationships involving `Base` (e.g. with `Plan` and `Tenant`) actually correct?**
  _`Base` has 17 INFERRED edges - model-reasoned connections that need verification._