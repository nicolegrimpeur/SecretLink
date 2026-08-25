# ---------- Stage 1: build ----------
ARG NODE_VERSION=24
FROM node:${NODE_VERSION}-alpine AS builder
WORKDIR /app

# Installe les deps
COPY package*.json ./
RUN npm ci

# Copie le code et build Angular
COPY . .
RUN npm run build

# ---------- Stage 2: serve ----------
FROM nginx:stable-alpine

# Config nginx custom : le vhost, plus le snippet d'en-têtes de sécurité qu'il inclut
COPY nginx/nginx.conf /etc/nginx/conf.d/default.conf
COPY nginx/security-headers.conf /etc/nginx/security-headers.conf

# Copie le build Angular dans Nginx
COPY --from=builder /app/www /usr/share/nginx/html/

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
