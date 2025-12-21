FROM node:18-alpine

# Create app directory
WORKDIR /usr/src/app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy application source
COPY . .

ENV NODE_ENV=production
EXPOSE 3000

CMD ["node", "server.js"]
