import type { Response } from 'express';

/**
 * Reads a table id from a URL segment. Only plain digits for a table number of 1 or more count:
 * "5abc", "0", "-1", "1e1" and "5.0" are not table ids, so they are never read as the number in front.
 * Returns null when the value is not a table id.
 */
export function parseTableId(raw: string): number | null {
  return parsePositiveInteger(raw);
}

/**
 * Reads an order number from a URL segment: only plain digits, a positive whole number.
 * "12abc", "0", "-1" and "1e1" are not order numbers. Returns null when the value is not one.
 */
export function parseOrderNumber(raw: string): number | null {
  return parsePositiveInteger(raw);
}

/** Plain digits only, no leading zero: a positive whole number, or null. */
function parsePositiveInteger(raw: string): number | null {
  return /^[1-9]\d*$/.test(raw) ? parseInt(raw, 10) : null;
}

/** Answers 404 UNKNOWN_ORDER in the error envelope. */
export function unknownOrder(res: Response, raw: string): void {
  res.status(404).json({ error: { code: 'UNKNOWN_ORDER', message: `Order ${raw} not found` } });
}

/** Answers 404 UNKNOWN_TABLE in the error envelope. */
export function unknownTable(res: Response, raw: string): void {
  res.status(404).json({ error: { code: 'UNKNOWN_TABLE', message: `Table ${raw} not found` } });
}
