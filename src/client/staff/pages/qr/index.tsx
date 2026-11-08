/**
 * The QR codes page (U7 Step 12). Rules: BR8.1 (one code and label per table, each holding <origin>/table/<n>, the table
 * list from GET /api/staff/tables), BR8.2 (Print shows only the codes and their labels, several to a page, with none of
 * the screen's buttons or notes: the .no-print class and the print stylesheet), BR8.3 (made in the browser).
 */
import React from 'react';
import { Banner, Button } from '../../../components/ui/index';
import { useRead } from '../useLiveRead';
import TableQr from './TableQr';
import '../../staff-u7.css';

interface TableRow {
  id: number;
  label: string;
}

export default function QrPage() {
  const { data, loading, error, reload } = useRead<{ tables: TableRow[] }>('/api/staff/tables');
  // The address the page was opened on (BR8.1).
  const origin = typeof window !== 'undefined' ? window.location.origin : '';

  return (
    <section data-testid="qr-page" className="stack" style={{ gap: 'var(--space-4)' }}>
      <div className="page-head no-print">
        <div>
          <h1 style={{ margin: 0 }}>QR codes</h1>
          <p className="secondary" style={{ margin: '4px 0 0' }}>
            Codes open <span className="num" data-testid="qr-address">{origin}/table/&lt;number&gt;</span>
          </p>
        </div>
        <Button variant="primary" className="no-print" data-testid="print-qr" disabled={!data} onClick={() => window.print()}>
          Print
        </Button>
      </div>

      <div className="no-print">
        <Banner tone="info" icon="ℹ" title="Open this page on the restaurant's network address" testId="qr-network-note">
          Phones can only scan codes that point to an address they can reach, not "localhost".
        </Banner>
      </div>

      {loading && data === null && <p data-testid="qr-loading" className="secondary no-print">Loading the tables…</p>}
      {error && data === null && (
        <div data-testid="qr-error" role="alert" className="stack no-print">
          <p style={{ margin: 0 }}>The tables could not be loaded. Try again.</p>
          <Button small onClick={reload}>
            Retry
          </Button>
        </div>
      )}

      {data && (
        <div className="u7-qr-sheet" data-testid="qr-sheet">
          {data.tables.map((t) => (
            <TableQr key={t.id} tableId={t.id} label={t.label} origin={origin} />
          ))}
        </div>
      )}
    </section>
  );
}
