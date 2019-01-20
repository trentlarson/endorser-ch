import jwtRouter from './api/controllers/jwt-router';
import actionRouter from './api/controllers/action-router';

export default function routes(app) {
  app.use('/api/claim', jwtRouter)
  app.use('/api/action', actionRouter)
}
