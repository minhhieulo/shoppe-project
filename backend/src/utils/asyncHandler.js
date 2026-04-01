/**
 * Wraps an async Express handler so any thrown error is forwarded to next()
 * and caught by the global error handler — no try/catch needed in controllers.
 */
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

module.exports = asyncHandler;