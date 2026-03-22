.PHONY: dev prod down migrate logs

dev:
	docker compose -f docker-compose.dev.yml up --build

prod:
	docker compose up --build -d

down:
	docker compose down

migrate:
	docker compose -f docker-compose.dev.yml exec api alembic upgrade head

makemigration:
	docker compose -f docker-compose.dev.yml exec api alembic revision --autogenerate -m "$(msg)"

logs:
	docker compose -f docker-compose.dev.yml logs -f api worker
