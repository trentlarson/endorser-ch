import claimV2Router from  './api/controllers/claim-router';
import claimRouter from    './api/controllers/claim-v1-router';
import reportV2Router from './api/controllers/report-router';
import reportRouter from   './api/controllers/report-v1-router';

import actionRouter from   './api/controllers/storage-action-router';
import eventRouter from    './api/controllers/storage-event-router';
import planRouter from     './api/controllers/storage-project-router';
import tenureRouter from   './api/controllers/storage-tenure-router';

import utilRouter from     './api/controllers/util-router';


export default function routes(app) {
  app.use('/api/v2/claim', claimV2Router)
  app.use('/api/claim', claimRouter)
  app.use('/api/v2/report', reportV2Router)
  app.use('/api/reportAll', reportV2Router) // deprecate after mobile is updated
  app.use('/api/report', reportRouter)
  app.use('/api/util', utilRouter)

  app.use('/api/action', actionRouter)
  app.use('/api/event', eventRouter)
  app.use('/api/plan', planRouter)
  app.use('/api/tenure', tenureRouter)

  app.use('*', (req, res) => { res.status(404).send({ error: 'Route not found' }) })
}
