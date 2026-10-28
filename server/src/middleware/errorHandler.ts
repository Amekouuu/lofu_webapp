import { ErrorRequestHandler, RequestHandler } from 'express';

interface HttpErrorLike {
  status?: number;
  statusCode?: number;
  type?: string;
  message?: string;
}

// Unknown /api routes answer JSON instead of Express's default HTML page.
export const notFoundHandler: RequestHandler = (_req, res) => {
  res.status(404).json({ success: false, message: 'Route not found.' });
};

// Last line of defence. Everything that reaches here becomes a JSON response, and details of
// unexpected (5xx) errors stay in the server log instead of going to the client.
export const errorHandler: ErrorRequestHandler = (err: HttpErrorLike, _req, res, next) => {
  if (res.headersSent) {
    next(err);
    return;
  }

  // body-parser errors
  if (err.type === 'entity.too.large') {
    res.status(413).json({
      success: false,
      message: 'That request is too large. Try smaller or fewer images.',
    });
    return;
  }

  if (err.type === 'entity.parse.failed') {
    res.status(400).json({ success: false, message: 'Request body is not valid JSON.' });
    return;
  }

  const status = err.status ?? err.statusCode ?? 500;

  if (status >= 500) {
    console.error('Unhandled error:', err);
    res.status(500).json({
      success: false,
      message: 'Something went wrong. Please try again.',
    });
    return;
  }

  res.status(status).json({ success: false, message: err.message || 'Request failed.' });
};
