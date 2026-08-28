# The image intentionally builds from source only; it never expects .git.
FROM node:22-bookworm-slim AS web-build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY index.html tsconfig.json vite.config.ts ./
COPY src ./src
COPY public ./public
RUN npm run build

FROM rust:1.88-slim-bookworm AS api-build
WORKDIR /app
COPY server ./server
RUN cargo build --release --manifest-path server/Cargo.toml

FROM debian:bookworm-slim AS runtime
ARG BUILD_SHA=dev
ARG GIT_SHA=dev
ARG SOURCE_COMMIT=dev
ENV BUILD_SHA=${BUILD_SHA}
RUN groupadd --system app && useradd --system --gid app --no-create-home app
COPY --from=web-build /app/dist /app/dist
COPY --from=api-build /app/server/target/release/integration-handoff-room-api /usr/local/bin/integration-handoff-room-api
USER app
EXPOSE 8080
ENTRYPOINT ["/usr/local/bin/integration-handoff-room-api"]
