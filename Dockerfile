# syntax=docker/dockerfile:1

# glibc-based: onnxruntime-node (embeddings) ships no binaries for Alpine's musl
FROM node:22.4-bookworm-slim
ARG ENDORSER_VERSION
RUN npm install -g npm@9.8.1
RUN apt-get update && apt-get install -y --no-install-recommends git ca-certificates && rm -rf /var/lib/apt/lists/*
RUN git clone https://github.com/trentlarson/endorser-ch /app/endorser-ch

WORKDIR /app/endorser-ch
RUN git checkout $ENDORSER_VERSION
RUN npm ci
RUN npm run compile

CMD ["npm", "start"]
