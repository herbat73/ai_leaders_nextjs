# syntax=docker/dockerfile:1
# EasyRMS: Next.js app (packages/app) with its internal workspace packages.
# Configuration is environment-only (see Configuration.md); nothing is baked into the image.

ARG NODE_VERSION=24

# ---- deps: install the whole workspace from the lockfile ----
FROM node:${NODE_VERSION}-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/app/package.json packages/app/
COPY packages/core/package.json packages/core/
COPY packages/db/package.json packages/db/
COPY packages/ui/package.json packages/ui/
RUN npm ci

# ---- build ----
FROM deps AS build
COPY . .
# NODE_ENV=production is required: with development the /_global-error prerender fails.
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ---- runtime ----
FROM node:${NODE_VERSION}-alpine AS runtime
LABEL org.opencontainers.image.title="EasyRMS"
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
# The workspace keeps its dev dependencies on purpose: `npm run db:migrate` (tsx) runs from this image.
COPY --from=build --chown=node:node /app /app
USER node
EXPOSE 3000
# Required at run time: EASYRMS_DATABASE_URL, EASYRMS_TRUST_PROXY, EASYRMS_ORDER_SOURCE,
# EASYRMS_GUEST_SESSION_SECRET, EASYRMS_AGENT_SESSION_SECRET, EASYRMS_CLAMAV_HOST.
CMD ["npm", "run", "start"]
