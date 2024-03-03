import Express from 'express';
import * as path from 'path';
import * as bodyParser from 'body-parser';
import helmet from 'helmet';
import * as http from 'http';
import * as os from 'os';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import l from './logger';

import ClaimService from '../api/services/claim.service';
import { ERROR_CODES, UPORT_PUSH_TOKEN_HEADER } from '../api/services/util';
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
  let jwt
  const authBearer = req.headers['Authorization'.toLowerCase()]
  const BEARER_PREFIX = 'Bearer '
  if (authBearer != null
      && authBearer.startsWith(BEARER_PREFIX)) {
    jwt = authBearer.substring(BEARER_PREFIX.length)
  } else {
    jwt = req.headers[UPORT_PUSH_TOKEN_HEADER.toLowerCase()]
  }
  if (!jwt || jwt == "undefined") { // maybe I can eliminate the "undefined" case from uport-demo
    // Is every endpoint OK to access now that we're hiding DIDs?
    if (req.originalUrl.startsWith("/api/action")
        || req.originalUrl.startsWith("/api/claim") // POST checks for jwtEncoded, GET hides all DIDs
        || req.originalUrl.startsWith("/api/event")
        || req.originalUrl.startsWith("/api/plan")
        || req.originalUrl.startsWith("/api/project")
        || req.originalUrl.startsWith("/api/report/actionClaimsAndConfirmationsSince?")
        || req.originalUrl.startsWith("/api/report/tenureClaimsAndConfirmationsAtPoint?")
        || req.originalUrl.startsWith("/api/report/issuersWhoClaimedOrConfirmed?")
        || req.originalUrl.startsWith("/api/reportAll/claims?")
        || req.originalUrl.startsWith("/api/tenure")
        || req.originalUrl.startsWith("/api/util")
        || req.originalUrl.startsWith("/api/v2/claim")
        || req.originalUrl.startsWith("/api/v2/report")
       ) {
      // these endcpoints are OK to hit without a token... so won't even set tokenIssuer
      next()
    } else {
      res.status(401).json('Missing Bearer JWT In Authorization header').end()
    }
  } else {
    ClaimService.decodeAndVerifyJwt(jwt)
      .then((result) => {
        //console.log("Elements of the decoded JWT", result)
        //console.log("... and the JWT doc publicKey", result.doc && result.doc.publicKey)
        //console.log("... and the JWT doc authentication", result.doc && result.doc.authentication)
        const {payload, header, issuer} = result
        res.locals.tokenIssuer = payload.iss
        next()
      })
      .catch(e => {
        // You would think that the separate parameter of "e" in this l.error would give the most info, but you'd be wrong in some cases such as when infura.io complains about "legacy access request rate exceeded".
        l.error("Low-level error while parsing JWT:", e, " ... which has JSON.stringify thus: " + JSON.stringify(e))
        // ... and you'd think that those would at least hint at stack info but you'd be wrong.
        l.error(e.stack)
        l.error("Here's the JWT:", jwt)
        // There's a potential to get more fine-grained with a 'clientError'.
        const errorObj = e.clientError
              || {
                message: "Low-level error while parsing JWT '" + jwt + "': " + JSON.stringify(e),
                code: ERROR_CODES.JWT_VERIFY_FAILED
              }
        res.status(400).json({ error: errorObj }).end()
      })
  }
}

export default class ExpressServer {
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
