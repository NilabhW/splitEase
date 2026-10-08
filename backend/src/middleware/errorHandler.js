const AppError = require('../utils/AppError');

function notFound(req, res, next) {
  next(new AppError(404, 'NOT_FOUND', `Route ${req.method} ${req.originalUrl} not found`));
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  let { status, code, message } = err;
  if (err.code === 11000) {
    status = 409;
    code = 'DUPLICATE';
    message = 'Resource already exists';
  } else if (err.name === 'CastError') {
    status = 404;
    code = 'NOT_FOUND';
    message = 'Resource not found';
  } else if (err.type === 'entity.parse.failed') {
    status = 400;
    code = 'VALIDATION_ERROR';
    message = 'Invalid JSON body';
  }
  if (!status) {
    status = 500;
    code = 'INTERNAL_ERROR';
    message = 'Something went wrong';
    if (process.env.NODE_ENV !== 'test') console.error(err);
  }
  const error = { code, message };
  if (err instanceof AppError && err.details) error.details = err.details;
  res.status(status).json({ success: false, error });
}

module.exports = { notFound, errorHandler };
