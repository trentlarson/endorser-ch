import actionRouter from './api/controllers/action-router';
import claimRouter from './api/controllers/jwt-router';
import eventRouter from './api/controllers/event-router';
import reportRouter from './api/controllers/report-router';
import tenureRouter from './api/controllers/tenure-router';
import utilRouter from './api/controllers/util-router';

export default function routes(app) {
  app.use('/api/action', actionRouter)
  app.use('/api/claim', claimRouter)
  app.use('/api/event', eventRouter)
  app.use('/api/report', reportRouter)
  app.use('/api/tenure', tenureRouter)
  app.use('/api/util', utilRouter)
}
