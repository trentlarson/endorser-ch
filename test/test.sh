
echo "Looks like you gotta be connected to the internet to run these (probably due to sig/JWT verification)."

rm -f ../endorser-ch-test.sqlite3

NODE_ENV=test DBUSER=sa DBPASS=sasa npm run migrate

# funny... this works without setting the DBUSER & DBPASS
NODE_ENV=test DBUSER=sa DBPASS=sasa PORT=3330 npm run test
