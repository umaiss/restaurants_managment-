import React from 'react';
import { createPortal } from 'react-dom';

/**
 * Renders a sheet on the page body. A sheet is position: fixed, but inside the page header (a frosted bar with
 * a backdrop filter) or an animated screen, "fixed" is measured from that parent instead of the window, so the
 * sheet came out the height of the header and its controls could not be reached. On the body it always covers
 * the window.
 */
export function Portal({ children }: { children: React.ReactNode }) {
  if (typeof document === 'undefined') return null;
  return createPortal(children, document.body);
}
