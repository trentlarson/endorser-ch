# syntax=docker/dockerfile:1

FROM ubuntu:20.04
ARG ENDORSER_VERSION

ENV NODE_VERSION=16.18.0
RUN apt update
RUN apt install -y curl
RUN curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.3/install.sh | bash
ENV NVM_DIR=/root/.nvm
RUN . "$NVM_DIR/nvm.sh" && nvm install ${NODE_VERSION}
RUN . "$NVM_DIR/nvm.sh" && nvm use v${NODE_VERSION}
RUN . "$NVM_DIR/nvm.sh" && nvm alias default v${NODE_VERSION}
ENV PATH="/root/.nvm/versions/node/v${NODE_VERSION}/bin/:${PATH}"

RUN apt install -y git
RUN git clone https://github.com/trentlarson/endorser-ch

WORKDIR endorser-ch
RUN git checkout $ENDORSER_VERSION
RUN npm ci
RUN npm run compile
RUN cp .env.local .env

CMD npm start
