import { Request, Response, NextFunction } from "express";
import { verifyPlatformToken, PlatformAuthTokenPayload } from "../auth.js";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      platformAdmin?: PlatformAuthTokenPayload;
    }
  }
}

export function requirePlatformAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing or malformed Authorization header" });
  }
  try {
    const payload = verifyPlatformToken(header.slice("Bearer ".length));
    // jwt.verify only checks the signature, not the payload shape — both
    // token types here share the same JWT_SECRET, so a validly-signed
    // tenant-user token decodes without throwing. Without this explicit
    // check, a regular tenant user's own token would authenticate as a
    // platform admin. Found this exactly that way, by actually trying it.
    if (typeof payload.platformAdminId !== "string") {
      return res.status(401).json({ error: "Invalid or expired token" });
    }
    req.platformAdmin = payload;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}
