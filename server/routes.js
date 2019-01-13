import jwtRouter from './api/controllers/jwt/router';

export default function routes(app) {
  app.use('/api/claim', jwtRouter);
}
