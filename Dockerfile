# Shared base stage for all application images.
FROM node:22-alpine AS base

# All relative paths below are resolved from /app inside the container.
WORKDIR /app

# Copy dependency manifests first so Docker can cache dependency installation.
COPY package*.json ./


# Development stage used by docker compose locally.
FROM base AS dev

# Install all dependencies, including dev dependencies like TypeScript tools.
RUN npm install

# Copy the rest of the project into the image.
COPY . .

# This documents the HTTP port used by media-api.
EXPOSE 3000

# Default command for the dev image. Compose overrides this for worker services.
CMD ["npm", "run", "dev:api"]


# Build stage used to compile TypeScript into dist/.
FROM base AS build

# npm install is used here because this scaffold does not include a lockfile yet.
RUN npm install

# Copy the full project so TypeScript can compile it.
COPY . .

# Build TypeScript output.
RUN npm run build


# Production stage kept separate from dev/build for a cleaner runtime image.
FROM node:22-alpine AS prod

WORKDIR /app

# Copy manifests into the fresh runtime image.
COPY package*.json ./

# Only install runtime dependencies in production.
RUN npm install --omit=dev

# Copy the built JavaScript output from the build stage.
COPY --from=build /app/dist ./dist

EXPOSE 3000

# Production default command.
CMD ["node", "dist/server.js"]
