// Extend vitest's expect with @testing-library/jest-dom matchers.
// We import expect from vitest and extensions from jest-dom to avoid
// the "expect is not defined" error that occurs when jest-dom v7 tries
// to extend the global expect in a node environment.
import { expect } from 'vitest';

// U5 (BR1.1, BR11.3): tests sign in as staff with this PIN. It is a test value, set only here and in
// playwright.config.ts; the app never has a PIN written in its code.
process.env.STAFF_PIN = '4242';
import * as matchers from '@testing-library/jest-dom/matchers';
expect.extend(matchers);
