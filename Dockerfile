FROM node:22-alpine

WORKDIR /app

# Install ALL dependencies (including dev - needed for tsx + vite build)
COPY package*.json ./
RUN npm ci --include=dev

# Copy source files
COPY . .

# Build the frontend (vite)
RUN npm run build

# Production env
ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

# Use tsx directly to run the TypeScript server
CMD ["npx", "tsx", "server/index.ts"]
