import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env';
import apiRoutes from './routes';
import { apiLimiter } from './middleware/rateLimits';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';

const app = express();

// Behind Render's proxy, req.ip is the proxy's address unless Express is told how many hops
// to trust. The rate limiters key on req.ip, so this must be right in production.
app.set('trust proxy', env.trustProxy);

const allowedOrigins = [
  env.clientUrl,
  'http://localhost:4200',
  'http://localhost:3000',
];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, Postman)
      if (!origin) return callback(null, true);
      // In development, accept the client from any localhost port (ng serve, previews).
      const isDevLocalhost =
        env.nodeEnv === 'development' && /^http:\/\/localhost:\d+$/.test(origin);
      if (allowedOrigins.includes(origin) || isDevLocalhost) {
        return callback(null, true);
      }
      return callback(Object.assign(new Error(`CORS blocked: ${origin}`), { status: 403 }));
    },
    credentials: true,
  })
);

app.use(helmet());
app.use(morgan(env.nodeEnv === 'production' ? 'combined' : 'dev'));
app.use('/api', apiLimiter);

// Only these two routes legitimately carry base64 images, so only they get a big body limit.
// Declared first: body-parser skips a request that an earlier parser already handled.
app.post('/api/posts', express.json({ limit: '30mb' }));
app.patch('/api/users/me', express.json({ limit: '4mb' }));
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));

app.get('/', (_req, res) => {
  res.json({
    success: true,
    message: 'Welcome to the LoFu API',
  });
});

app.use('/api', apiRoutes);
app.use('/api', notFoundHandler);
app.use(errorHandler);

export default app;