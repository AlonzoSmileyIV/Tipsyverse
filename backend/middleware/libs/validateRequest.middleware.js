import { z } from "zod";

const writeBodySchema = z.record(z.string(), z.unknown());

export const validateBody = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({
      success: false,
      code: "VALIDATION_ERROR",
      message: "The request contains invalid values.",
      issues: result.error.issues.map(({ path, message }) => ({
        field: path.join("."),
        message,
      })),
    });
  }
  req.body = result.data;
  return next();
};

// Every JSON write receives a consistent structural baseline. Domain routers
// should compose this with a strict schema for their own fields.
export const validateWriteBody = (req, res, next) => {
  if (!["POST", "PUT", "PATCH"].includes(req.method)) return next();
  if (req.is("multipart/form-data")) return next();
  // Express leaves req.body undefined when a write intentionally has no body
  // (for example, toggle-like actions). Treat that as an empty object while
  // continuing to reject explicit non-object JSON payloads.
  if (req.body === undefined) req.body = {};
  return validateBody(writeBodySchema)(req, res, next);
};

export const schemas = {
  login: z
    .object({
      emailOrUsername: z.string().trim().min(1).max(254).optional(),
      email: z.string().trim().max(254).optional(),
      username: z.string().trim().max(100).optional(),
      password: z.string().min(1).max(256),
    })
    .refine(
      ({ emailOrUsername, email, username }) =>
        Boolean(emailOrUsername || email || username),
      { message: "Email or username is required.", path: ["emailOrUsername"] }
    ),
  logout: z.object({
    reason: z
      .enum([
        "manual",
        "inactivity",
        "session-expired",
        "security",
        "admin-force",
        "account-suspended",
      ])
      .optional(),
  }),
};
