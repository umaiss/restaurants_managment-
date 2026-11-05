import React from 'react';

export default function StaffView() {
  return (
    <div
      data-testid="staff-view"
      style={{
        minHeight: '100vh',
        background: 'var(--bg-primary)',
        color: 'var(--text-primary)',
        padding: '1.5rem 1rem',
      }}
    >
      {/* Header */}
      <header
        style={{
          marginBottom: '1.5rem',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          paddingBottom: '1rem',
        }}
      >
        <h1
          style={{
            fontSize: '1.5rem',
            fontWeight: 700,
            letterSpacing: '-0.02em',
          }}
        >
          Kitchen Board
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
          Live orders across all tables
        </p>
      </header>

      {/* Placeholder content — real board built in U3 */}
      <section
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '50vh',
          gap: '0.75rem',
          color: 'var(--text-muted)',
        }}
      >
        <span style={{ fontSize: '3rem' }}>🍽️</span>
        <p style={{ fontSize: '1rem', fontWeight: 500 }}>Orders will appear here</p>
        <p style={{ fontSize: '0.875rem' }}>Kitchen board UI coming in Bolt 3</p>
      </section>
    </div>
  );
}
