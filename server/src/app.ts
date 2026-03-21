import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env';
import apiRoutes from './routes';

const app = express();

app.use(
  cors({
    origin: env.clientUrl,
    credentials: true,
  })
);

app.use(helmet());
app.use(morgan('dev'));

// 20mb to handle up to 4 base64 images per post before Cloudinary upload
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

app.get('/', (_req, res) => {
  res.json({
    success: true,
    message: 'Welcome to the LoFu API',
  });
});

app.use('/api', apiRoutes);

export default app;