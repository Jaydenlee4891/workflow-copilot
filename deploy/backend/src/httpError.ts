import { Request, Response, NextFunction, RequestHandler } from "express";

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export function handleError(err: unknown, res: Response) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message });
  }
  console.error(err);
  return res.status(500).json({ error: "Internal server error" });
}

/**
 * Wraps an async route handler so a rejected promise always becomes an
 * HTTP error response instead of an unhandled rejection. Express 4 does
 * not await async handlers or catch their rejections on its own — without
 * this, one malformed request (e.g. an invalid UUID in a URL param) can
 * crash the entire process for every tenant, not just fail the one
 * request. Found exactly that way: a missing try/catch on one admin GET
 * route took the whole server down during testing. Applied to every
 * route in every router, not just the one that broke, since the same gap
 * existed silently in already-shipped routes too.
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
): RequestHandler {
  return (req, res, next) => {
    fn(req, res, next).catch((err) => handleError(err, res));
  };
}
