

echo "First will run tests without JWT validation."

rm -f ../endorser-ch-test-local.sqlite3

NODE_ENV=test-local DBUSER=sa DBPASS=sasa npm run flyway migrate

# funny... this works without setting the DBUSER & DBPASS
NODE_ENV=test-local DBUSER=sa DBPASS=sasa PORT=3330 npm run test$1

exit 0




echo "Now will run tests with JWT validation at Infura, which are much slower, which require internet, and which sometimes fail due to rate-limiting at Infura."
echo ""
echo "If you get this error: 'Converting circular structure to JSON'"
echo "... it indicates a network problem."
echo ""
echo "If you get this error: 'Timeout of x000ms exceeded.'"
echo "... it indicates some latency going on (typically at Infura). Waiting a few hours usually helps; you could also add longer timeout lengths."
echo ""
echo "If you get this error: 'could not detect network (event=\"noNetwork\", code=NETWORK_ERROR, version=providers/5.7.1)'"
echo "... then you're missing the INFURA_PROJECT_ID in the .env file."
echo ""

echo "In 10..."
sleep 1
echo "9..."
sleep 1
echo "8..."
sleep 1
echo "7..."
sleep 1
echo "6..."
sleep 1
echo "5..."
sleep 1
echo "4..."
sleep 1
echo "3..."
sleep 1
echo "2..."
sleep 1
echo "1..."
sleep 1
echo "now."

rm -f ../endorser-ch-test.sqlite3

NODE_ENV=test DBUSER=sa DBPASS=sasa npm run flyway migrate

# funny... this works without setting the DBUSER & DBPASS
NODE_ENV=test USE_INFURA=true DBUSER=sa DBPASS=sasa PORT=3330 npm run test$1

echo "Also be sure to check that the API docs still work: http://localhost:3000/api-explorer/"
