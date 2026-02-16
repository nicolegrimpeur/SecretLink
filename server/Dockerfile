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

# Run the application
CMD ["node", "dist/main.js"]
