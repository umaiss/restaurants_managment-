import React from 'react';
import { Routes, Route } from 'react-router-dom';
import KitchenBoardScreen from '../screens/staff/KitchenBoardScreen';
import TableBillScreen from '../screens/staff/TableBillScreen';

export default function StaffView() {
  return (
    <div
      data-testid="staff-view"
      style={{
        minHeight: '100vh',
        background: 'var(--bg-primary, #0f172a)',
        color: 'var(--text-primary, #f8fafc)',
      }}
    >
      <Routes>
        <Route index element={<KitchenBoardScreen />} />
        <Route path="tables/:id" element={<TableBillScreen />} />
      </Routes>
    </div>
  );
}
