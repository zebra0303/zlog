FROM node:22-alpine AS client-build
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
WORKDIR /app
COPY package.json package-lock.json* ./
COPY server/package.json ./server/
COPY shared/package.json ./shared/
COPY client/package.json ./client/
COPY .npmrc ./
RUN npm ci --workspace=server --workspace=shared --omit=dev --include-workspace-root
COPY --from=client-build /app/client/dist ./client/dist
COPY --from=server-build /app/server/dist ./server/dist
COPY shared/ ./shared/
RUN mkdir -p /app/data /app/uploads/avatar/original /app/uploads/avatar/256 /app/uploads/avatar/64
ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000
CMD ["node", "--expose-gc", "server/dist/index.js"]
