FROM node:22-alpine AS client-build
# git is required to install @zebra/core from GitHub
RUN apk add --no-cache git
WORKDIR /app
COPY package.json package-lock.json* ./
COPY client/package.json ./client/
COPY server/package.json ./server/
COPY shared/package.json ./shared/
COPY .npmrc ./
RUN npm ci --workspace=client --workspace=shared --include-workspace-root
COPY shared/ ./shared/
COPY client/ ./client/
COPY tsconfig.base.json ./
RUN npm run build -w client

FROM node:22-alpine AS server-build
RUN apk add --no-cache git python3 make g++
WORKDIR /app
COPY package.json package-lock.json* ./
COPY client/package.json ./client/
COPY server/package.json ./server/
COPY shared/package.json ./shared/
COPY .npmrc ./
RUN npm ci --workspace=server --workspace=shared --include-workspace-root
COPY shared/ ./shared/
COPY server/ ./server/
COPY tsconfig.base.json ./
RUN npm run build -w server

FROM node:22-alpine AS production
RUN apk add --no-cache git python3 make g++
WORKDIR /app
COPY package.json package-lock.json* ./
COPY server/package.json ./server/
COPY shared/package.json ./shared/
COPY client/package.json ./client/
COPY .npmrc ./
RUN npm ci --workspace=server --workspace=shared --omit=dev --include-workspace-root \
  && apk del git python3 make g++
COPY --from=client-build /app/client/dist ./client/dist
COPY --from=server-build /app/server/dist ./server/dist
COPY shared/ ./shared/
RUN mkdir -p /app/data /app/uploads/images /app/uploads/avatar/original /app/uploads/avatar/256 /app/uploads/avatar/192 /app/uploads/avatar/64 \
  && chown -R node:node /app/data /app/uploads
ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000
USER node
CMD ["node", "--expose-gc", "server/dist/index.js"]
