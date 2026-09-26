# Build Stage
FROM node:22-alpine AS builder

WORKDIR /app

# Copy dependency definitions
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm ci || npm install

# Copy source code and build configs
COPY tsconfig.json tsup.config.ts ./
COPY src/ ./src/

# Build production artifacts
RUN npm run build

# Production Stage
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Copy built files and package metadata
COPY package.json ./
COPY --from=builder /app/dist ./dist

# Symlink executable
RUN npm link

# Default entrypoint
ENTRYPOINT ["service-keepalive"]

# Default fallback arguments (overridden at runtime)
CMD ["--help"]
