FROM node:24-slim AS web
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages ./packages
COPY frontend ./frontend
RUN pnpm install --frozen-lockfile && pnpm build

FROM python:3.12-slim
WORKDIR /app
COPY requirements-desk.lock ./
RUN pip install --no-cache-dir -r requirements-desk.lock
COPY finrobot_equity ./finrobot_equity
COPY --from=web /app/frontend/dist ./frontend/dist
ENV DESK_DATA_DIR=/data
RUN useradd --create-home desk && mkdir /data && chown desk:desk /data
USER desk
EXPOSE 8001
CMD ["uvicorn", "finrobot_equity.research_desk.main:app", "--host", "0.0.0.0", "--port", "8001"]
