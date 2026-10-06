import express, { Express, Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { randomUUID } from 'crypto';
import { env } from './config/env.js';
import { errorHandler } from './middleware/errorHandler.js';
import { healthRouter } from './routes/health.routes.js';
import { authRouter } from './routes/auth.routes.js';
import { lotsRouter } from './routes/lots.routes.js';
import { bookingsRouter } from './routes/bookings.routes.js';
import { paymentsRouter } from './routes/payments.routes.js';
import { sensorsRouter } from './routes/sensors.routes.js';
import { adminRouter } from './routes/admin.routes.js';
import { guardRouter } from './routes/guard.routes.js';
import { availabilityRouter } from './routes/availability.routes.js';

export function createApp(): Express {
  const app = express();

  // Security Rule 7: Set trust proxy hops
  app.set('trust proxy', env.TRUST_PROXY_HOPS);

  // Request ID middleware
  app.use((req: Request, res: Response, next: NextFunction) => {
    const requestId = (req.headers['x-request-id'] as string) || randomUUID();
    req.headers['x-request-id'] = requestId;
    res.setHeader('x-request-id', requestId);
    next();
  });

  // Security Rule 8: helmet security headers
  app.use(helmet());

  // Security Rule 8: CORS allowlist from CORS_ORIGINS with credentials, no wildcard
  const allowedOrigins = env.CORS_ORIGINS.split(',').map((origin) => origin.trim());
  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps, curl, or same-origin)
        if (
          !origin ||
          allowedOrigins.includes(origin) ||
          (env.NODE_ENV === 'development' && /^http:\/\/(localhost|127\.0\.0\.1):(517\d|4173)$/.test(origin))
        ) {
          callback(null, true);
        } else {
          callback(new Error('Origin not permitted by CORS policy'));
        }
      },
      credentials: true,
    })
  );

  // Security Rule 3: Raw body parser for webhook mounted before express.json
  app.use(
    '/api/v1/payments/webhook',
    express.raw({ type: 'application/json', limit: '100kb' })
  );

  // Security Rule 3: JSON body size limit 100kb
  app.use(express.json({ limit: '100kb' }));
  app.use(express.urlencoded({ extended: true, limit: '100kb' }));
  app.use(cookieParser());

  // Unversioned health & readiness endpoints per C4
  app.use('/', healthRouter);

  // Versioned API v1 routes per C4 & C7
  const apiV1 = express.Router();
  apiV1.use('/auth', authRouter);
  apiV1.use('/parking-lots', lotsRouter);
  apiV1.use('/bookings', bookingsRouter);
  apiV1.use('/payments', paymentsRouter);
  apiV1.use('/sensors', sensorsRouter);
  apiV1.use('/admin', adminRouter);
  apiV1.use('/guard', guardRouter);
  apiV1.use('/availability', availabilityRouter);

  app.use('/api/v1', apiV1);

  // Central error handling middleware per Security Rule 8
  app.use(errorHandler);

  return app;
}
