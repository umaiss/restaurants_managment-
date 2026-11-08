/**
 * The staff page registry (U5 Step 13, BR14.2, contract 7): every staff page with its route, navigation
 * label and page, filled in completely. U7 replaces the files its pages live in and never edits this file.
 * The Kitchen Board stays the index page and the bill stays at tables/:id.
 */
import React from 'react';
import KitchenBoardScreen from '../../screens/staff/KitchenBoardScreen.js';
import TableBillScreen from '../../screens/staff/TableBillScreen.js';
import FloorPage from './floor/index.js';
import MenuManagementPage from './menu/index.js';
import SpecialPage from './special/index.js';
import SalesPage from './sales/index.js';
import QrPage from './qr/index.js';
import StationPage from './stations/index.js';

export interface StaffPage {
  key: string;
  /** Path under /staff; '' is the index page. */
  path: string;
  /** The navigation label, in the words of the mockups. */
  label: string;
  icon: string;
  element: React.ReactElement;
  /** False for pages reached from other pages and not listed in the navigation. */
  inNav: boolean;
}

export const STAFF_PAGES: StaffPage[] = [
  { key: 'board', path: '', label: 'Kitchen Board', icon: '🍳', element: <KitchenBoardScreen />, inNav: true },
  { key: 'floor', path: 'floor', label: 'Floor map', icon: '🗺️', element: <FloorPage />, inNav: true },
  { key: 'menu', path: 'menu', label: 'Menu management', icon: '📝', element: <MenuManagementPage />, inNav: true },
  { key: 'special', path: 'special', label: "Chef's special", icon: '⭐', element: <SpecialPage />, inNav: true },
  { key: 'sales', path: 'sales', label: 'Past visits and sales', icon: '📈', element: <SalesPage />, inNav: true },
  { key: 'qr', path: 'qr', label: 'QR codes', icon: '🔳', element: <QrPage />, inNav: true },
  { key: 'stations', path: 'stations/:station', label: 'Station', icon: '🔥', element: <StationPage />, inNav: false },
  { key: 'bill', path: 'tables/:id', label: 'Table bill', icon: '🧾', element: <TableBillScreen />, inNav: false },
];
