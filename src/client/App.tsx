import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import TableView from './views/TableView';
import StaffView from './views/StaffView';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/table/:id" element={<TableView />} />
        <Route path="/staff" element={<StaffView />} />
        <Route path="/" element={<Navigate to="/staff" replace />} />
        <Route path="*" element={<Navigate to="/staff" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
