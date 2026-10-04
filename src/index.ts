import './common/env'
import Server from './common/server'
import routes from './common/routes'
import { startSweepSchedule } from './api/services/embedding.service'

const app = new Server()
  .router(routes)
  .listen(process.env.PORT);

// keep profile & plan embeddings current (EMBEDDING_SWEEP_INTERVAL_MINUTES=0 disables)
startSweepSchedule()

export default app
