FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies without running scripts (to avoid prepare hook)
RUN npm ci --ignore-scripts

# Copy source code
COPY tsconfig.json ./
COPY src/ ./src/

# Build the application
RUN npm run build

# Create a smaller production image
FROM node:18-alpine AS production

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production --ignore-scripts

# Copy built files from builder stage
COPY --from=builder /app/dist ./dist

# Set executable permissions
RUN chmod +x ./dist/index.js

# Create a non-root user
RUN addgroup -S appuser && adduser -S appuser -G appuser
USER appuser

# Set the binary as entrypoint
ENTRYPOINT ["node", "dist/index.js"] 