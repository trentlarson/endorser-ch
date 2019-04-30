
echo "We believe you gotta be connected to the internet to run these (probably due to sig/JWT verification)."
echo "For example, here's an error you might get: 'TypeError: Converting circular structure to JSON'"

rm -f ../endorser-ch-test.sqlite3

NODE_ENV=test DBUSER=sa DBPASS=sasa npm run migrate

# funny... this works without setting the DBUSER & DBPASS
NODE_ENV=test DBUSER=sa DBPASS=sasa PORT=3330 npm run test

echo "Also be sure to check that the API docs still work: http://localhost:3000/api-explorer/"
