import React from 'react';
import { Routes, Route } from 'react-router-dom';
import KitchenBoardScreen from '../screens/staff/KitchenBoardScreen';

// Placeholder for U4's TableBillScreen — built in Bolt 4
function TableBillPlaceholder() {
  return (
    <div
      data-testid="table-bill-placeholder"
      style={{
        padding: '2rem 1rem',
        color: 'var(--text-secondary, #94a3b8)',
        textAlign: 'center',
      }}
    >
      <p>Table bill — coming in Bolt 4</p>
    </div>
  );
}

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
        <Route path="tables/:id" element={<TableBillPlaceholder />} />
      </Routes>
    </div>
  );
}
