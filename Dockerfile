# The browser build is plain JS, so it runs once on the build machine's
# platform even for multi-arch images.
FROM --platform=$BUILDPLATFORM node:26-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npx ng build

# No runtime dependencies: Node 24 runs server/*.ts directly (type stripping).
FROM node:26-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=8080
COPY package.json ./
COPY server ./server
COPY shared ./shared
COPY --from=build /app/dist ./dist
USER node
EXPOSE 8080
HEALTHCHECK CMD wget -q --spider http://localhost:8080/healthz || exit 1
CMD ["node", "server/main.ts"]
