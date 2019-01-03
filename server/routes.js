import examplesRouter from './api/controllers/examples/router';
import jwtRouter from './api/controllers/jwt/router';

export default function routes(app) {
  app.use('/api/examples', examplesRouter);
  app.use('/api/jwt', jwtRouter);
}
