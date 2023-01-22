import actionRouter from './api/controllers/action-router';
import claimRouter from './api/controllers/claim-router';
import eventRouter from './api/controllers/event-router';
import { planRouter, projectRouter } from './api/controllers/project-router';
import reportv2Router from './api/controllers/report-v2-router';
import reportRouter from './api/controllers/report-router';
import tenureRouter from './api/controllers/tenure-router';
import utilRouter from './api/controllers/util-router';

export default function routes(app) {
  app.use('/api/action', actionRouter)
  app.use('/api/claim', claimRouter)
  app.use('/api/v2/claim', claimRouter)
  app.use('/api/event', eventRouter)
  app.use('/api/plan', planRouter)
  app.use('/api/project', projectRouter)
  app.use('/api/report', reportRouter)
  app.use('/api/reportAll', reportv2Router)
  app.use('/api/v2/report', reportv2Router)
  app.use('/api/tenure', tenureRouter)
  app.use('/api/util', utilRouter)
  app.use('*', (req, res) => { res.status(404).send({ error: 'Route not found' }) })
}
