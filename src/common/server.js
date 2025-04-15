import Express from 'express';
import * as path from 'path';
import * as bodyParser from 'body-parser';
import helmet from 'helmet';
import * as http from 'http';
import * as os from 'os';
import cookieParser from 'cookie-parser';
import cors from 'cors';

import { ERROR_CODES, UPORT_PUSH_TOKEN_HEADER } from '../api/services/util.js';
import { decodeAndVerifyJwt } from "../api/services/vc";
import l from './logger';
const app = new Express();

app.use(helmet())

const expressSwagger = require('express-swagger-generator')(app);

const DEFAULT_PORT = process.env.PORT || '80'

let schemes = ['http', 'https']
if (process.env.SWAGGER_HTTPS_DEFAULT) {
  schemes = ['https', 'http']
}
let options = {
  swaggerDefinition: {
    info: {
      title: 'endorser-ch',
      description: 'Endorser recording & search',
      version: process.env.ENDORSER_VERSION,
    },
    host: (process.env.EXT_DOMAIN || 'localhost') + ':' + (process.env.EXT_PORT || DEFAULT_PORT),
    basePath: '',
    produces: [
      "application/json",
      "application/xml"
    ],
    schemes: schemes,
    /**
    securityDefinitions: {
      JWT: {
        type: 'apiKey',
          in: 'header',
        name: 'Authorization',
        description: "",
      }
    }
    **/
    /**
       Other places to tweak API docs: ../api/controllers/* /*.js (router & controller)
     **/
  },
  basedir: __dirname, //app absolute path
  files: ['../routes.js', '../**/*-router.js'] //Path to the API handle folder
};

function requesterInfo(req, res, next) {
  let authorizationJwt
  const authBearer = req.headers['Authorization'.toLowerCase()]
  const BEARER_PREFIX = 'Bearer '
  if (authBearer != null
      && authBearer.startsWith(BEARER_PREFIX)) {
    authorizationJwt = authBearer.substring(BEARER_PREFIX.length)
  } else {
    authorizationJwt = req.headers[UPORT_PUSH_TOKEN_HEADER.toLowerCase()]
  }
  if (!authorizationJwt || authorizationJwt == "undefined") { // maybe we can eliminate the "undefined" case from uport-demo
    if (
      req.originalUrl.startsWith("/api/userUtil")
      || req.originalUrl.startsWith("/api/partner/groupOnboard")
    ) {
      // refactor to handle this endpoint in the router like all the rest
      res.status(401).json('Missing Bearer JWT In Authorization header').end()
    } else {
      // most endpoints are OK to hit without a token so won't even set tokenIssuer
      next()
    }
  } else {
    decodeAndVerifyJwt(authorizationJwt)
      .then((result) => {
        // potentially available: {didResolutionResult w/ didDocument, issuer, payload, policies, signer, verified}
        //console.log("Elements of the decoded JWT", result)
        //console.log("... and the JWT doc publicKey", result.doc && result.doc.publicKey)
        //console.log("... and the JWT doc authentication", result.doc && result.doc.authentication)
        const { header, issuer, payload, verified } = result
        if (issuer !== payload.iss) {
          res.status(400).json({
            error: {
              message: "Decoded issuer of " + issuer + " does not match payload issuer of " + payload.iss,
              code: ERROR_CODES.JWT_VERIFY_FAILED
            }
          }).end()
        } else if (!verified) {
          res.status(400).json({
            error: {
              message: "Signature failed validation.",
              code: ERROR_CODES.JWT_VERIFY_FAILED
            }
          }).end()
        } else {
          res.locals.authTokenIssuer = issuer
          next()
        }
      })
      .catch(e => {
        // You would think that the separate parameter of "e" in this l.error would give the most info, but you'd be wrong in some cases such as when infura.io complains about "legacy access request rate exceeded".
        l.error("Low-level error while parsing JWT:", e, " ... which has JSON.stringify thus: " + JSON.stringify(e))
        // ... and you'd think that those would at least hint at stack info but you'd be wrong.
        l.error(e.stack)
        l.error("Here's the JWT:", authorizationJwt)
        // There's a potential to get more fine-grained with a 'clientError'.
        const errorObj = e.clientError
              || {
                message: "Low-level error while parsing JWT '" + authorizationJwt + "': " + JSON.stringify(e),
                code: ERROR_CODES.JWT_VERIFY_FAILED
              }
        res.status(400).json({ error: errorObj }).end()
      })
  }
}

export default class Server {
  constructor() {
    const root = path.normalize(`${__dirname}/../..`);
    app.set('appPath', `${root}client`);
    // 10kb should be enough for each claim.
    // Using 40kb to allow for about 500 hashes in contact correlation service.
    app.use(bodyParser.json({ limit: '40kb' }));
    app.use(bodyParser.urlencoded({ extended: true }));
    app.use(cookieParser(process.env.SESSION_SECRET));
    app.use(Express.static(`${root}/public`));
    app.use(cors({"allowedHeaders":["Authorization", "Content-Type", UPORT_PUSH_TOKEN_HEADER]}))
    app.use('/api', requesterInfo)
    app.use('/util/makeMeGloballyVisible', requesterInfo)
  }

  router(routes) {

    expressSwagger(options)

    // Error handler to display the validation error as HTML
    // eslint-disable-next-line no-unused-vars, no-shadow
    app.use((err, req, res, next) => {
      res.status(err.status || 500);
      res.send(
        `<h1>${err.status || 500} Error</h1>` +
          `<pre>${err.message}</pre>`);
    });
    routes(app);

    return this;
  }

  listen(port = DEFAULT_PORT) {
    const welcome = p => () => l.info(`up and running in ${process.env.NODE_ENV || 'development'} @: ${os.hostname()} on port: ${p}}`);
    http.createServer(app).listen(port, welcome(port));
    return app;
  }
}
