import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { applyThemeMode, readThemeMode } from './hooks/useTheme';

// Apply the saved theme before the first paint, so a reload never flashes the wrong one (BR10.2).
applyThemeMode(readThemeMode());

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
