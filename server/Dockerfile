FROM node:lts-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY src ./src

# Build TypeScript
RUN npm run build

# Remove development dependencies
RUN npm prune --production

# Expose port
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:'+(process.env.PORT||3000)+'/health', r=>{ if(r.statusCode!==200) process.exit(1) }).on('error', ()=>process.exit(1))"

# Run the application
CMD ["node", "dist/main.js"]
