# Stage 1: Build client
FROM node:22-alpine3.22 AS client-builder
WORKDIR /usr/src/conductor/client

# Install git (needed for git dependencies in package.json)
RUN apk add --no-cache git

# Copy package.json only (let npm resolve dependencies for Linux)
COPY client/package.json ./
RUN npm install --no-audit

# Copy source and build
COPY client/ ./
RUN npm run build

# Stage 2: Build server
FROM node:22-alpine3.22 AS server-builder
WORKDIR /usr/src/conductor/server

# Copy package.json only (let npm resolve dependencies for Linux)
COPY server/package.json ./
RUN npm install --no-audit

# Copy source and build
COPY server/ ./
RUN npm run build

# Stage 3: Production runtime
FROM node:22-alpine3.22

# Build arguments for dynamic labels
ARG VERSION=dev
ARG BUILD_DATE
ARG VCS_REF

# OCI Image Labels (https://github.com/opencontainers/image-spec/blob/main/annotations.md)
LABEL org.opencontainers.image.title="LibreTexts Conductor" \
      org.opencontainers.image.description="The LibreTexts Conductor platform Docker image" \
      org.opencontainers.image.version="${VERSION}" \
      org.opencontainers.image.created="${BUILD_DATE}" \
      org.opencontainers.image.revision="${VCS_REF}" \
      org.opencontainers.image.vendor="LibreTexts" \
      org.opencontainers.image.documentation="https://github.com/LibreTexts/conductor/blob/master/README.md" \
      org.opencontainers.image.source="https://github.com/LibreTexts/conductor" \
      org.opencontainers.image.licenses="MIT"

WORKDIR /usr/src/conductor/server

# Copy package.json only and install ONLY production dependencies
COPY server/package.json ./
RUN npm install --no-audit --omit=dev && \
    npm cache clean --force

# Copy built artifacts from previous stages
COPY --from=server-builder /usr/src/conductor/server/dist ./dist
COPY --from=client-builder /usr/src/conductor/client/dist ../client/dist

EXPOSE 5000

HEALTHCHECK --interval=10s --timeout=5s --start-period=45s --retries=3 \
  CMD wget -nv -t1 --spider http://localhost:5000/health || exit 1

ENTRYPOINT [ "node", "dist/server.js" ]
