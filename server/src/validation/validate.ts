import { RequestHandler } from 'express';
import { ZodType } from 'zod';

// Validates req.body against a zod schema. On success the parsed (trimmed, defaulted,
// unknown-fields-stripped) data replaces req.body; on failure it answers 400 with the first
// problem as `message` (the Angular forms show that) and every problem in `errors`.
export function validateBody(schema: ZodType): RequestHandler {
  return (req, res, next) => {
    const result = schema.safeParse(req.body ?? {});

    if (!result.success) {
      const errors = result.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      }));

      res.status(400).json({
        success: false,
        message: errors[0]?.message ?? 'Invalid request.',
        errors,
      });
      return;
    }

    req.body = result.data;
    next();
  };
}
