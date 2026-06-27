# Backend: Node 22 running the TypeScript server via tsx (matches how the
# project runs in development — no separate build step needed).
FROM node:22-slim

WORKDIR /app

# Install dependencies first so this layer caches unless package files change.
COPY package.json package-lock.json ./
RUN npm ci

# Copy source.
COPY tsconfig.json ./
COPY src ./src

# The server listens on PORT (default 3000). Document storage and DB
# connection come from environment (see docker-compose.yml).
EXPOSE 3000

CMD ["npm", "run", "start"]
