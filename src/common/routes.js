import claimV2Router from '../api/controllers/claim-router';
import claimV1Router from '../api/controllers/claim-v1-router';
import partnerRouter from  '../api/controllers/partner-router';
import reportV2Router from '../api/controllers/report-router';
import reportV1Router from '../api/controllers/report-v1-router';

import actionRouter from '../api/controllers/storage-action-router';
import eventRouter from '../api/controllers/storage-event-router';
import planRouter from '../api/controllers/storage-project-router';
import tenureRouter from '../api/controllers/storage-tenure-router';

import utilRouter from '../api/controllers/util-router';
import utilUserRouter from '../api/controllers/util-user-router';

export default function routes(app) {
  app.use('/api/v2/claim', claimV2Router)
  app.use('/api/claim', claimV1Router)
  app.use('/api/v2/report', reportV2Router)
  app.use('/api/reportAll', reportV2Router) // deprecate after mobile is updated
  app.use('/api/report', reportV1Router)
  app.use('/api/util', utilRouter)
  app.use('/api/userUtil', utilUserRouter)

  /**
   * These are for specific types of claims.
   */
  app.use('/api/action', actionRouter)
  app.use('/api/event', eventRouter)
  app.use('/api/plan', planRouter)
  app.use('/api/tenure', tenureRouter)

  /**
   * The partner endpoints should be on a different domain, too.
   * They use a separate DB and are only in this service for deploy convenience.
   */
  app.use('/api/partner', partnerRouter)

  app.use('*', (req, res) => { res.status(404).send({ error: 'Route not found' }) })
}
