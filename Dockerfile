# syntax=docker/dockerfile:1

# glibc-based: onnxruntime-node (embeddings) ships no binaries for Alpine's musl.
# Debian 13 (trixie, glibc 2.41): the sqlite3 6.x prebuilt binary needs glibc 2.38+, so bookworm (2.36) fails.
FROM node:22.23-trixie-slim
ARG ENDORSER_VERSION
RUN npm install -g npm@9.8.1
RUN apt-get update && apt-get install -y --no-install-recommends git ca-certificates && rm -rf /var/lib/apt/lists/*
RUN git clone https://github.com/trentlarson/endorser-ch /app/endorser-ch

WORKDIR /app/endorser-ch
RUN git checkout $ENDORSER_VERSION
RUN npm ci
RUN npm run compile

CMD ["npm", "start"]
