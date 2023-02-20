import actionRouter from './api/controllers/action-router';
import claimRouter from './api/controllers/claim-router';
import claimV2Router from './api/controllers/claim-v2-router';
import eventRouter from './api/controllers/event-router';
import planRouter from './api/controllers/project-router';
import reportV2Router from './api/controllers/report-v2-router';
import reportRouter from './api/controllers/report-router';
import tenureRouter from './api/controllers/tenure-router';
import utilRouter from './api/controllers/util-router';

export default function routes(app) {
  app.use('/api/action', actionRouter)
  app.use('/api/claim', claimRouter)
  app.use('/api/v2/claim', claimV2Router)
  app.use('/api/event', eventRouter)
  app.use('/api/plan', planRouter)
  app.use('/api/report', reportRouter)
  app.use('/api/reportAll', reportV2Router) // deprecate after mobile is updated
  app.use('/api/v2/report', reportV2Router)
  app.use('/api/tenure', tenureRouter)
  app.use('/api/util', utilRouter)
  app.use('*', (req, res) => { res.status(404).send({ error: 'Route not found' }) })
}
