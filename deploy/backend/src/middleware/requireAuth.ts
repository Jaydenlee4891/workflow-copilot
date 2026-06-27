import { Request, Response, NextFunction } from "express";
import { verifyToken, AuthTokenPayload } from "../auth.js";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthTokenPayload;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing or malformed Authorization header" });
  }
  try {
    const payload = verifyToken(header.slice("Bearer ".length));
    // Matching check to requirePlatformAuth: jwt.verify only validates
    // the signature, not the payload shape, and both token types share
    // JWT_SECRET — so a platform-admin token would otherwise also pass
    // here, just with userId/tenantId reading as undefined.
    if (typeof payload.userId !== "string" || typeof payload.tenantId !== "string") {
      return res.status(401).json({ error: "Invalid or expired token" });
    }
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}
