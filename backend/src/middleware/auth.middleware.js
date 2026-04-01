const jwt = require("jsonwebtoken");
const AppError = require("../utils/AppError");

/**
 * auth(roles?) — verifies JWT, optionally restricts to given roles.
 * Usage:
 *   auth()                — any authenticated user
 *   auth(["admin"])       — admin only
 *   auth(["admin","staff"]) — admin or staff
 */
function auth(requiredRoles = []) {
  return (req, _res, next) => {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;

    if (!token) return next(new AppError("Unauthorized — no token", 401));

    try {
      const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
      req.user = decoded;

      if (requiredRoles.length > 0 && !requiredRoles.includes(decoded.role)) {
        return next(new AppError("Forbidden — insufficient role", 403));
      }
      return next();
    } catch {
      return next(new AppError("Unauthorized — invalid or expired token", 401));
    }
  };
}

module.exports = auth;