FROM node:22-alpine3.22
LABEL org.opencontainers.image.source="https://github.com/LibreTexts/conductor"

WORKDIR /usr/src/conductor

COPY . .

# Install system dependencies (primarily for canvas)
RUN apk add --update --no-cache \
  make \
  g++ \
  jpeg-dev \
  cairo-dev \
  giflib-dev \
  pango-dev \
  libtool \
  autoconf \
  automake

# Install client dependencies and build frontend
WORKDIR /usr/src/conductor/client
RUN npm ci && npm run build

# Install server dependencies
WORKDIR /usr/src/conductor/server
RUN npm ci

# Build server
RUN npm run build

EXPOSE 5000

HEALTHCHECK --timeout=5s --start-period=30s \
  CMD wget -nv -t1 --spider http://localhost:5000/health || exit 1

ENTRYPOINT [ "node", "dist/server.js" ]