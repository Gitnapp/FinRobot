.PHONY: setup build start demo dev test
setup:
	uv venv --python 3.12
	uv pip install --python .venv/bin/python -r requirements-desk.lock
	pnpm install --frozen-lockfile
build:
	pnpm build
start:
	infisical run --env=dev --silent -- .venv/bin/python run_web_app.py
demo:
	.venv/bin/python run_web_app.py
dev:
	pnpm dev
test:
	.venv/bin/python -m pytest tests/desk -q
	pnpm typecheck
