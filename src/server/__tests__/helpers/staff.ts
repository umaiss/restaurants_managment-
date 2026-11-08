/**
 * Test helper (U5 Step 10, BR11.3 and BR14.3): sign in as staff with the test PIN.
 * v1's server tests that call a staff action use requestAsStaff(app) in place of request(app).
 * It opens a session through StaffAccess with the PIN the test setup set (STAFF_PIN), on its own
 * address, so a lockout test never locks these tests out. Nothing here is reachable from a route.
 */
import supertest from 'supertest';
import type { Express } from 'express';
import { isSessionValid, resetLoginAttemptsForTest, signIn } from '../../staffAccess.js';

let cachedToken: string | null = null;

/** The Cookie header value of a signed-in staff session (re-signs in when the session is gone). */
export function staffCookie(): string {
  if (cachedToken === null || !isSessionValid(cachedToken)) {
    resetLoginAttemptsForTest();
    cachedToken = signIn('test-staff-helper', process.env.STAFF_PIN);
  }
  return `staff_session=${cachedToken}`;
}

/** supertest, with the staff session cookie on every request. */
export function requestAsStaff(app: Express) {
  const cookie = () => staffCookie();
  return {
    get: (url: string) => supertest(app).get(url).set('Cookie', cookie()),
    post: (url: string) => supertest(app).post(url).set('Cookie', cookie()),
    put: (url: string) => supertest(app).put(url).set('Cookie', cookie()),
    patch: (url: string) => supertest(app).patch(url).set('Cookie', cookie()),
    delete: (url: string) => supertest(app).delete(url).set('Cookie', cookie()),
  };
}
