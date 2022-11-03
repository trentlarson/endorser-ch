import Express from 'express';
import * as path from 'path';
import * as bodyParser from 'body-parser';
import helmet from 'helmet';
import * as http from 'http';
import * as os from 'os';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import l from './logger';

import JwtService from '../api/services/jwt.service';
import { ERROR_CODES, UPORT_PUSH_TOKEN_HEADER } from '../api/services/util';
const app = new Express();

app.use(helmet())

const expressSwagger = require('express-swagger-generator')(app);

let options = {
  swaggerDefinition: {
    info: {
      title: 'endorser-ch',
      description: 'Endorser recording & search',
      version: process.env.VERSION,
    },
    host: 'localhost:' + process.env.PORT,
    basePath: '',
    produces: [
      "application/json",
      "application/xml"
    ],
    schemes: ['http', 'https'],
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
  let jwt = req.headers[UPORT_PUSH_TOKEN_HEADER.toLowerCase()]
  if (!jwt || jwt == "undefined") { // maybe I can eliminate the "undefined" case from uport-demo
    if (req.originalUrl.startsWith("/api/claim") // even for POST since that JWT payload will be verified
        || req.originalUrl.startsWith("/api/claim?")
        || req.originalUrl.startsWith("/api/claim/")
        || req.originalUrl.startsWith("/api/report/actionClaimsAndConfirmationsSince?")
        || req.originalUrl.startsWith("/api/report/tenureClaimsAndConfirmationsAtPoint?")
        || req.originalUrl.startsWith("/api/report/issuersWhoClaimedOrConfirmed?")
        || req.originalUrl.startsWith("/api/reportAll/claims?")
        || req.originalUrl.startsWith("/api/util/updateHashChain")) {
      // these endcpoints are OK to hit without a token... so won't even set tokenIssuer
      next()
    } else {
      res.status(401).json('Missing JWT In ' + UPORT_PUSH_TOKEN_HEADER).end()
    }
  } else {
    JwtService.decodeAndVerifyJwt(jwt)
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
        l.error("Low-level error while parsing JWT:", e, " ... with toString(): " + e)
        // ... and you'd think that those would at least hint at stack info but you'd be wrong.
        l.error(e.stack)
        l.error("Here's the JWT:", jwt)
        // There's a potential to get more fine-grained with a 'clientError'.
        res.status(400).json({ error: {
          message: "Low-level error while parsing JWT '" + jwt + "': " + e,
          code: ERROR_CODES.JWT_VERIFY_FAILED
        }}).end()
      })
  }
}

export default class ExpressServer {
  constructor() {
    const root = path.normalize(`${__dirname}/../..`);
    app.set('appPath', `${root}client`);
    app.use(bodyParser.json({ limit: '10kb' }));
    app.use(bodyParser.urlencoded({ extended: true }));
    app.use(cookieParser(process.env.SESSION_SECRET));
    app.use(Express.static(`${root}/public`));
    app.use(cors({"allowedHeaders":["Content-Type", UPORT_PUSH_TOKEN_HEADER]}))
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

  listen(port = process.env.PORT) {
    const welcome = p => () => l.info(`up and running in ${process.env.NODE_ENV || 'development'} @: ${os.hostname()} on port: ${p}}`);
    http.createServer(app).listen(port, welcome(port));
    return app;
  }
}
