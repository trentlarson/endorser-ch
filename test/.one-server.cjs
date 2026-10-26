/**
 * Send every test request to the server that the app under test starts on
 * PORT (see test.sh), at 127.0.0.1.
 *
 * Given an app, supertest starts a server on a fresh port for each request.
 * On macOS, roughly one request in a few thousand then hangs, resets, or gets
 * bytes that aren't HTTP ("Parse Error: Expected HTTP/"), even against a
 * trivial app; a suite run makes enough requests to hit that about every other
 * time. Requests to one long-lived server don't.
 */

const supertestPath = require.resolve('supertest');
const supertest = require(supertestPath);

if (process.env.PORT) {
  const base = 'http://127.0.0.1:' + process.env.PORT;
  const toOneServer = (app) => supertest(typeof app === 'function' ? base : app);
  Object.assign(toOneServer, supertest);
  require.cache[supertestPath].exports = toOneServer;
}
