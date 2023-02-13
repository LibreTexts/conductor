FROM node:16-alpine
LABEL org.opencontainers.image.source="https://github.com/LibreTexts/conductor"

WORKDIR /usr/src/conductor

COPY . .

# Install client dependencies and build frontend
WORKDIR /usr/src/conductor/client
RUN npm install && npm run build

# Install server dependencies
WORKDIR /usr/src/conductor/server
RUN npm install

EXPOSE 5000

HEALTHCHECK --timeout=5s --start-period=5s \
  CMD wget -nv -t1 --spider http://localhost:5000/health || exit 1

ENTRYPOINT [ "node", "server.js" ]