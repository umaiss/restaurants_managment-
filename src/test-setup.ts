// Extend vitest's expect with @testing-library/jest-dom matchers.
// We import expect from vitest and extensions from jest-dom to avoid
// the "expect is not defined" error that occurs when jest-dom v7 tries
// to extend the global expect in a node environment.
import { expect } from 'vitest';
import * as matchers from '@testing-library/jest-dom/matchers';
expect.extend(matchers);
