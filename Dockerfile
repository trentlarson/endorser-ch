# syntax=docker/dockerfile:1

FROM node:16.19-alpine3.17
ARG ENDORSER_VERSION
RUN npm install -g npm@latest
RUN apk add git
RUN git clone https://github.com/trentlarson/endorser-ch

WORKDIR endorser-ch
RUN git checkout $ENDORSER_VERSION
RUN npm ci
RUN npm run compile
RUN cp .env.local .env

CMD npm start
