import Express from 'express';
import * as path from 'path';
import * as bodyParser from 'body-parser';
import * as http from 'http';
import * as os from 'os';
import cookieParser from 'cookie-parser';
import l from './logger';

const app = new Express();
const expressSwagger = require('express-swagger-generator')(app);

let options = {
  swaggerDefinition: {
    info: {
      description: 'Endorser recording & search',
      title: 'Swagger',
      version: '1.0.0',
    },
    host: 'localhost:3000',
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
  },
  basedir: __dirname, //app absolute path
  files: ['../routes.js', '../**/router.js'] //Path to the API handle folder
};

export default class ExpressServer {
  constructor() {
    const root = path.normalize(`${__dirname}/../..`);
    app.set('appPath', `${root}client`);
    app.use(bodyParser.json());
    app.use(bodyParser.urlencoded({ extended: true }));
    app.use(cookieParser(process.env.SESSION_SECRET));
    app.use(Express.static(`${root}/public`));
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
