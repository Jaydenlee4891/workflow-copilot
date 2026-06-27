# Frontend: build the Vite app, then serve the static output with nginx.
# nginx also reverse-proxies /api to the backend (see nginx.conf), so the
# browser talks to a single origin and never needs to know the backend's
# address directly.

# ---- build stage ----
FROM node:22-slim AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Vite inlines env vars at build time. Point the API base at /api, which
# nginx proxies to the backend. Overridable at build via --build-arg.
ARG VITE_API_BASE_URL=/api
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
RUN npm run build

# ---- serve stage ----
FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
