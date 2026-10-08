const AppError = require('../utils/AppError');

// validate(schema) parses req.body with a Zod schema and replaces it with the parsed value
module.exports = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    const message = result.error.issues
      .map((i) => (i.path.length ? `${i.path.join('.')}: ${i.message}` : i.message))
      .join('; ');
    return next(new AppError(400, 'VALIDATION_ERROR', message));
  }
  req.body = result.data;
  next();
};
