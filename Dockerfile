FROM node:20-alpine AS deps
WORKDIR /app
RUN apk add --no-cache python3 make g++
COPY package.json package-lock.json ./
RUN npm ci

FROM node:20-alpine AS runner
WORKDIR /app
RUN apk add --no-cache python3 make g++
ENV NODE_ENV=production
ENV DB_PATH=/app/data/subscribers.db
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build
RUN mkdir -p /app/data
VOLUME /app/data
EXPOSE 3000
CMD ["npm", "start"]
