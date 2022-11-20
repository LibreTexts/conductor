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

ENTRYPOINT [ "node", "server.js" ]