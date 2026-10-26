#
# Usage: test/test.sh [test] [args]
# Example: test/test.sh
# Example: test/test.sh test test/controller-partner-3-group-matching.js

echo "Run tests without full Peer DID JWT validation."

# the DB paths below and in src/conf are relative to the repo root
cd "$(dirname "$0")/.." || exit 1

# a second run would delete the DBs out from under this one
LOCK=../endorser-ch-test-local.lock
if ! mkdir "$LOCK" 2>/dev/null; then
  echo "Another test run is using the test DBs. If none is running, remove $LOCK"
  exit 1
fi
trap 'rmdir "$LOCK"' EXIT

export NODE_ENV=test-local
# tests start embedding sweeps themselves, through the admin endpoint
export EMBEDDING_SWEEP_INTERVAL_MINUTES=0

rm -f ../endorser-ch-$NODE_ENV.sqlite3
rm -f ../endorser-partner-$NODE_ENV.sqlite3

DBUSER=sa DBPASS=sasa npm run flyway migrate

# funny... this works without setting the DBUSER & DBPASS
test=${1:-test}
DBUSER=sa DBPASS=sasa PORT=3330 npm run $test $2
status=$?

echo "Also be sure to check that the API docs still work: http://localhost:3000/api-explorer/"
exit $status
