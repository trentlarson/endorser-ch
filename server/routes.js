import claimV2Router from  './api/controllers/claim-router';
import claimRouter from    './api/controllers/claim-v1-router';
import partnerRouter from  './api/controllers/partner-router';
import reportV2Router from './api/controllers/report-router';
import reportRouter from   './api/controllers/report-v1-router';
import storageActionRouter from   './api/controllers/storage-action-router';
import storageEventRouter from    './api/controllers/storage-event-router';
import storagePlanRouter from     './api/controllers/storage-project-router';
import storageTenureRouter from   './api/controllers/storage-tenure-router';
import utilRouter from     './api/controllers/util-router';
import utilUserRouter from './api/controllers/util-user-router';


export default function routes(app) {
  app.use('/api/v2/claim', claimV2Router)
  app.use('/api/claim', claimRouter)
  app.use('/api/partner', partnerRouter)
  app.use('/api/v2/report', reportV2Router)
  app.use('/api/reportAll', reportV2Router) // deprecate after mobile is updated
  app.use('/api/report', reportRouter)
  app.use('/api/util', utilRouter)
  app.use('/api/userUtil', utilUserRouter)

  app.use('/api/action', storageActionRouter)
  app.use('/api/event', storageEventRouter)
  app.use('/api/plan', storagePlanRouter)
  app.use('/api/tenure', storageTenureRouter)

  app.use('*', (req, res) => { res.status(404).send({ error: 'Route not found' }) })
}
