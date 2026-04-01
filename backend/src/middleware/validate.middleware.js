const { validationResult } = require("express-validator");

/**
 * validate(rules) — run express-validator rules then reject with 422 if any fail.
 * Usage:
 *   router.post("/login", validate([
 *     body("email").isEmail(),
 *     body("password").notEmpty(),
 *   ]), loginHandler)
 */
const validate = (rules) => async (req, res, next) => {
  await Promise.all(rules.map((rule) => rule.run(req)));
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({ message: "Validation failed", errors: errors.array() });
  }
  return next();
};

module.exports = validate;