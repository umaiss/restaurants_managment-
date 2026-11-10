/**
 * Errors shared by the v2 repositories and routes (U5 Step 5).
 * Every error response keeps v1's shape { "error": { "code", "message", "details"? } }.
 */
import type { Response } from 'express';

export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AppError';
  }
}

/** The HTTP status for each error code the contracts name. */
export const STATUS_BY_CODE: Record<string, number> = {
  INVALID_REQUEST: 400,
  INVALID_QUANTITY: 400,
  EMPTY_ORDER: 400,
  UNKNOWN_ITEM: 400,
  INVALID_OPTIONS: 400,
  INVALID_KIND: 400,
  INVALID_RATING: 400,
  INVALID_COMMENT: 400,
  INVALID_LABEL: 400,
  TOO_MANY_TABLES: 409,
  TABLE_IN_USE: 409,
  ITEM_NOT_IN_VISIT: 400,
  INVALID_ACTOR: 400,
  UNAUTHORIZED: 401,
  INVALID_PIN: 401,
  UNKNOWN_TABLE: 404,
  UNKNOWN_CALL: 404,
  UNKNOWN_ORDER: 404,
  NO_OPEN_VISIT: 409,
  VISIT_NOT_CLOSED: 409,
  RATING_LOCKED: 409,
  ILLEGAL_TRANSITION: 422,
  LOCKED: 429,
  NOT_BUILT: 501,
};

/** Sends the error envelope with the status the code maps to. */
export function sendApiError(
  res: Response,
  status: number,
  code: string,
  message: string,
  details?: Record<string, unknown>
): void {
  res.status(status).json({ error: { code, message, ...(details ? { details } : {}) } });
}

/**
 * Answers a thrown AppError in the envelope and returns true; returns false for anything else so the
 * caller can log it and answer 500 (no silent failures).
 */
export function sendIfAppError(res: Response, err: unknown): boolean {
  if (err instanceof AppError && STATUS_BY_CODE[err.code] !== undefined) {
    sendApiError(res, STATUS_BY_CODE[err.code], err.code, err.message, err.details);
    return true;
  }
  return false;
}

export function sendInternalError(res: Response, where: string, err: unknown): void {
  console.error(`${where} error:`, err);
  sendApiError(res, 500, 'INTERNAL_ERROR', 'Internal server error');
}
