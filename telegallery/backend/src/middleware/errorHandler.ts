import { NextFunction, Request, Response } from "express";
import { logger } from "../utils/logger";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** Wraps an async Express handler so rejected promises reach the error middleware. */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: any, req: Request, res: Response, next: NextFunction) {
  const status = err instanceof ApiError ? err.status : 500;
  const message = err?.message ?? "Internal server error";

  if (status >= 500) {
    logger.error(message, { stack: err?.stack, path: req.path });
  } else {
    logger.warn(message, { path: req.path });
  }

  res.status(status).json({
    error: message,
  });
}
