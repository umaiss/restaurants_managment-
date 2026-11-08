/**
 * Error answers of U7's routes (contract 3). U5's STATUS_BY_CODE does not know U7's codes and U5's
 * files are not edited, so U7's codes are mapped here; any other AppError falls back to U5's mapping.
 * Every answer keeps v1's shape { error: { code, message, details? } }.
 */
import type { Response } from 'express';
import { AppError, sendApiError, sendIfAppError, sendInternalError } from '../../errors.js';

export const U7_STATUS_BY_CODE: Record<string, number> = {
  INVALID_REQUEST: 400,
  UNKNOWN_STATION: 404,
  UNKNOWN_ORDER: 404,
  UNKNOWN_ITEM: 404,
  UNKNOWN_CATEGORY: 404,
  NO_LINES_FOR_STATION: 422,
  ILLEGAL_TRANSITION: 422,
};

export function invalid(field: string, message: string): AppError {
  return new AppError('INVALID_REQUEST', message, { field });
}

/** Answers a thrown error: U7's codes first, then U5's, else a logged 500 (no silent failures). */
export function sendU7Error(res: Response, where: string, err: unknown): void {
  if (err instanceof AppError && U7_STATUS_BY_CODE[err.code] !== undefined) {
    sendApiError(res, U7_STATUS_BY_CODE[err.code], err.code, err.message, err.details);
    return;
  }
  // transitionOrder throws OrderError (a code on the error object), not AppError.
  const coded = err as { code?: unknown; message?: unknown; name?: unknown };
  if (coded && coded.name === 'OrderError' && typeof coded.code === 'string' && U7_STATUS_BY_CODE[coded.code] !== undefined) {
    const message = String(coded.message ?? '').replace(/^[A-Z_]+: /, '');
    sendApiError(res, U7_STATUS_BY_CODE[coded.code], coded.code, message);
    return;
  }
  if (sendIfAppError(res, err)) return;
  sendInternalError(res, where, err);
}
