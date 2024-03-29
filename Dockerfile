# syntax=docker/dockerfile:1

FROM node:16.19-alpine3.17
ARG ENDORSER_VERSION
RUN npm install -g npm@9.8.1
RUN apk add git
RUN git clone https://github.com/trentlarson/endorser-ch

WORKDIR endorser-ch
RUN git checkout $ENDORSER_VERSION
RUN npm ci
RUN npm run compile

CMD npm start
