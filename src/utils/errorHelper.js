const { randomBytes } = require("crypto");

/**
 * Throw a UserFacingError when the message is safe to render verbatim to a
 * Slack end-user. sanitizeError() returns the message as-is.
 *
 * DO NOT use this for messages that include error.message from Prisma,
 * internal validation strings, file paths, request bodies, or anything
 * that could leak schema details. The whole point of this class is that
 * the developer has explicitly verified the message is safe.
 *
 * For unknown / unexpected errors, throw plain Error — sanitizeError will
 * return a generic message with a correlation id and log the full error.
 */
class UserFacingError extends Error {
  constructor(message) {
    super(message);
    this.name = "UserFacingError";
    this.userFacing = true;
  }
}

const DEFAULT_FALLBACK =
  "Something went wrong. Please try again, or contact an admin if this keeps happening.";

function sanitizeError(err, fallback = DEFAULT_FALLBACK) {
  if (err && err.userFacing && typeof err.message === "string") {
    return err.message;
  }
  const ref = randomBytes(4).toString("hex");
  console.error(`[error:${ref}]`, err);
  return `${fallback} (ref: ${ref})`;
}

module.exports = { UserFacingError, sanitizeError };
