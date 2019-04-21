import Express from 'express';
import * as path from 'path';
import * as bodyParser from 'body-parser';
import * as http from 'http';
import * as os from 'os';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import l from './logger';
import { UPORT_PUSH_TOKEN } from '../api/services/util';

const app = new Express();
const expressSwagger = require('express-swagger-generator')(app);

let options = {
  swaggerDefinition: {
    info: {
      title: 'endorser-ch',
      description: 'Endorser recording & search',
      version: '1.0.2',
    },
    host: 'localhost:' + process.env.port,
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

export default class ExpressServer {
  constructor() {
    const root = path.normalize(`${__dirname}/../..`);
    app.set('appPath', `${root}client`);
    app.use(bodyParser.json());
    app.use(bodyParser.urlencoded({ extended: true }));
    app.use(cookieParser(process.env.SESSION_SECRET));
    app.use(Express.static(`${root}/public`));
    app.use(cors({"allowedHeaders":["Content-Type", UPORT_PUSH_TOKEN]}))
  }

  router(routes) {

    // Error handler to display the validation error as HTML
    // eslint-disable-next-line no-unused-vars, no-shadow
    app.use((err, req, res, next) => {
      res.status(err.status || 500);
      res.send(
        `<h1>${err.status || 500} Error</h1>` +
          `<pre>${err.message}</pre>`);
    });
    routes(app);

    expressSwagger(options)

    return this;
  }

  listen(port = process.env.PORT) {
    const welcome = p => () => l.info(`up and running in ${process.env.NODE_ENV || 'development'} @: ${os.hostname()} on port: ${p}}`);
    http.createServer(app).listen(port, welcome(port));
    return app;
  }
}
