import { Router } from "express";
import { withPlatformContext } from "../db.js";
import { verifyPassword, signPlatformToken } from "../auth.js";
import { asyncHandler } from "../httpError.js";

export const platformAuthRouter = Router();

// No tenantId chicken-and-egg here, unlike tenant-user login —
// platform_admins.email is genuinely globally unique (UNIQUE constraint,
// no tenant_id column at all), since platform staff aren't tenant-scoped.
platformAuthRouter.post("/login", asyncHandler(async (req, res) => {
  const { email, password } = req.body ?? {};
  if (!email || !password) {
    return res.status(400).json({ error: "email and password are required" });
  }

  const admin = await withPlatformContext(async (client) => {
    const result = await client.query(
      "SELECT id, password_hash FROM platform_admins WHERE email = $1",
      [email]
    );
    return result.rows[0];
  });

  if (!admin) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const valid = await verifyPassword(password, admin.password_hash);
  if (!valid) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const token = signPlatformToken({ platformAdminId: admin.id });
  res.json({ token });
}));
