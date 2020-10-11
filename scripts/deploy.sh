#!/bin/bash

if [ -z "$1" ]
then
    echo "No release tag supplied (arg 1)"
    exit 1
fi

if [ -z "$2" ]
then
    echo "No SSH key file specified (arg 2)"
    exit 1
fi

if ! [ -z "$(git status --porcelain)" ]
then
    git status
    echo ""
    echo "Note that you've got those uncommitted changes.  They'll be pushed in the deploy."
    echo "Will continue in 5..."
    sleep 1
    echo "4..."
    sleep 1
    echo "3..."
    sleep 1
    echo "2..."
    sleep 1
    echo "1..."
    sleep 1
    echo "Continuing with deploy."
fi

git checkout $1

DEPLOY_DIR=endorser-ch

rsync -azv --exclude .git --exclude-from .gitignore -e "ssh -i $2" . ubuntu@endorser.ch:$DEPLOY_DIR

ssh -i $2 ubuntu@endorser.ch << EOF
  cd $DEPLOY_DIR

  echo "Running: npm ci"
  # Don't we need to add --production on the end of "npm ci"?
  npm ci

  echo "Running: npm compile"
  npm run compile

  # I think this is useful, but it causes a failure at startup.
  #echo "Running: npm prune"
  #npm prune --production

  perl -p -i -e "s/VERSION=.*/VERSION=$1/g" .env
EOF

git checkout master

echo "Deployed.  Now log in and get into screen and start the app."
