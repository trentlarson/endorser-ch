import actionRouter from './api/controllers/action-router';
import claimRouter from './api/controllers/jwt-router';
import eventRouter from './api/controllers/event-router';
import reportRouter from './api/controllers/report-router';

export default function routes(app) {
  app.use('/api/action', actionRouter)
  app.use('/api/claim', claimRouter)
  app.use('/api/event', eventRouter)
  app.use('/api/report', reportRouter)
}
