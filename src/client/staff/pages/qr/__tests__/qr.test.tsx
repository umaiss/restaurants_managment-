// @vitest-environment jsdom
/// <reference types="vitest/globals" />
// U7 Step 13: the QR codes page (BR8.1 to BR8.3). The `qrcode` package has no reader, and none is added: the tests
// check the exact text given to the package for each table and that the drawn matrix is the package's own for it.
import React from 'react';
import fs from 'fs';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import QRCode from 'qrcode';
import QrPage from '../index';
import TableQr, { qrPath, tableAddress } from '../TableQr';
import { failed, ok, stubStream } from '../../../__tests__/u7Mocks';

let tables: Array<{ id: number; label: string }>;
let fetchMock: import('vitest').Mock<any[], any>;

beforeEach(() => {
  stubStream();
  tables = Array.from({ length: 10 }, (_, i) => ({ id: i + 1, label: `Table ${i + 1}` }));
  fetchMock = vi.fn(async (input: RequestInfo | URL) => (String(input).startsWith('/api/staff/tables') ? ok({ tables }) : failed(404)));
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/** The dark modules of the package's own matrix for `text`, as the set of "x,y" cells of our path. */
function cellsOf(d: string): Set<string> {
  return new Set([...d.matchAll(/M(\d+) (\d+)h1v1h-1z/g)].map((m) => `${m[1]},${m[2]}`));
}

describe('adding a table (a new QR code)', () => {
  it('"+ Add table" posts to the server, shows the new table\'s code and says so', async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.startsWith('/api/staff/tables') && init?.method === 'POST') {
        tables = [...tables, { id: 11, label: 'Table 11' }];
        return ok({ id: 11, label: 'Table 11' }, 201);
      }
      return url.startsWith('/api/staff/tables') ? ok({ tables }) : failed(404);
    });
    render(<QrPage />);
    await screen.findByTestId('qr-table-10');
    expect(screen.queryByTestId('qr-table-11')).toBeNull();
    fireEvent.click(screen.getByTestId('add-table'));
    expect(await screen.findByTestId('qr-table-11')).toBeInTheDocument();
    expect(screen.getByTestId('qr-code-11')).toHaveAttribute('data-qr-text', `${window.location.origin}/table/11`);
    expect(screen.getByTestId('add-table-done')).toHaveTextContent('Table 11 added. Its QR code is below.');
    expect(fetchMock.mock.calls.filter((c) => c[1]?.method === 'POST')).toHaveLength(1);
  });

  it('says so when the table could not be added, and when the limit is reached', async () => {
    let status = 500;
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) =>
      String(input).startsWith('/api/staff/tables') ? (init?.method === 'POST' ? failed(status) : ok({ tables })) : failed(404)
    );
    render(<QrPage />);
    await screen.findByTestId('qr-table-10');
    fireEvent.click(screen.getByTestId('add-table'));
    expect(await screen.findByTestId('add-table-error')).toHaveTextContent('The table could not be added. Try again.');
    status = 409;
    fireEvent.click(screen.getByTestId('add-table'));
    await waitFor(() => expect(screen.getByTestId('add-table-error')).toHaveTextContent('most tables'));
    expect(screen.queryByTestId('add-table-done')).toBeNull();
  });

  it('the button is not printed with the codes', async () => {
    render(<QrPage />);
    await screen.findByTestId('qr-table-10');
    expect(screen.getByTestId('add-table').closest('.no-print')).not.toBeNull();
  });
});

describe('the address in each code (BR8.1)', () => {
  it('is the origin the page was opened on followed by /table/<n>, with no trailing slash', () => {
    expect(tableAddress('http://192.168.1.20:3000', 7)).toBe('http://192.168.1.20:3000/table/7');
    expect(tableAddress('http://192.168.1.20:3000/', 7)).toBe('http://192.168.1.20:3000/table/7');
    expect(tableAddress('https://cafe.example', 10)).toBe('https://cafe.example/table/10');
  });

  it('every table of the list has a code whose text is the origin plus /table/<its number>', async () => {
    render(<QrPage />);
    await screen.findByTestId('qr-table-10');
    for (const t of tables) {
      expect(screen.getByTestId(`qr-code-${t.id}`)).toHaveAttribute('data-qr-text', `${window.location.origin}/table/${t.id}`);
    }
  });

  it('shows the label and the path under each code', async () => {
    render(<QrPage />);
    const card = await screen.findByTestId('qr-table-3');
    expect(card).toHaveTextContent('Table 3');
    expect(card).toHaveTextContent('/table/3');
    expect(screen.getByRole('img', { name: 'QR code for Table 3' })).toBeInTheDocument();
  });

  it('the table list comes from the server: a different list gives different codes', async () => {
    tables = [{ id: 31, label: 'Patio 1' }, { id: 32, label: 'Patio 2' }];
    render(<QrPage />);
    await screen.findByTestId('qr-table-31');
    expect(screen.getAllByTestId(/^qr-table-/)).toHaveLength(2);
    expect(screen.getByTestId('qr-code-32')).toHaveAttribute('data-qr-text', `${window.location.origin}/table/32`);
  });
});

describe('the code is drawn from the package\'s own matrix, in the browser (BR8.3)', () => {
  it('the drawn squares are exactly the dark modules of QRCode.create for that text, shifted by the 4-module quiet zone', () => {
    const text = 'http://192.168.1.20:3000/table/7';
    const { d, size } = qrPath(text);
    const qr = QRCode.create(text, { errorCorrectionLevel: 'M' });
    expect(size).toBe(qr.modules.size + 8);
    const expected = new Set<string>();
    for (let row = 0; row < qr.modules.size; row++) for (let col = 0; col < qr.modules.size; col++) if (qr.modules.get(row, col)) expected.add(`${col + 4},${row + 4}`);
    expect(cellsOf(d)).toEqual(expected);
    expect(expected.size).toBeGreaterThan(100);
  });

  it('different tables give different codes', () => {
    expect(qrPath('http://x/table/1').d).not.toBe(qrPath('http://x/table/2').d);
  });

  it('makes no request of its own: nothing leaves the app, so it works offline', async () => {
    render(<QrPage />);
    await screen.findByTestId('qr-table-1');
    const urls = fetchMock.mock.calls.map((c) => String(c[0]));
    expect(urls.every((u) => u.startsWith('/api/'))).toBe(true);
    for (const u of urls) expect(u).not.toMatch(/^https?:/);
  });

  it('the page source has no outside address for making codes', () => {
    for (const f of ['src/client/staff/pages/qr/index.tsx', 'src/client/staff/pages/qr/TableQr.tsx']) {
      expect(fs.readFileSync(f, 'utf8'), f).not.toMatch(/https?:\/\/(api\.|chart\.|qr)/i);
    }
  });

  it('a code that cannot be drawn says so instead of breaking the page', () => {
    render(<TableQr tableId={1} label="Table 1" origin={`http://x/${'a'.repeat(3000)}`} />);
    expect(screen.getByText('Code unavailable')).toBeInTheDocument();
    expect(screen.getByText('Table 1')).toBeInTheDocument();
  });
});

describe('printing (BR8.2)', () => {
  it('the Print button prints the page', async () => {
    const print = vi.fn();
    vi.stubGlobal('print', print);
    render(<QrPage />);
    fireEvent.click(await screen.findByTestId('print-qr'));
    expect(print).toHaveBeenCalledTimes(1);
  });

  it('the screen\'s button, address line and note are marked no-print; the codes and labels are not', async () => {
    render(<QrPage />);
    await screen.findByTestId('qr-table-1');
    expect(screen.getByTestId('print-qr')).toHaveClass('no-print');
    expect(screen.getByTestId('qr-network-note').closest('.no-print')).not.toBeNull();
    expect(screen.getByTestId('qr-address').closest('.no-print')).not.toBeNull();
    expect(screen.getByTestId('qr-sheet').closest('.no-print')).toBeNull();
    expect(screen.getByTestId('qr-table-1').closest('.no-print')).toBeNull();
  });

  it('the print stylesheet hides the navigation, top bar and .no-print, and lays the codes out several to a page', () => {
    const css = fs.readFileSync('src/client/staff/staff-u7.css', 'utf8');
    const print = css.slice(css.indexOf('@media print'));
    expect(print).toMatch(/\.no-print[^{]*\{[^}]*display:\s*none/);
    expect(print).toMatch(/\.staff-nav-wrap/);
    expect(print).toMatch(/\.u7-qr-sheet\s*\{[^}]*repeat\(3/);
  });

  it('the page says a phone needs the restaurant\'s network address, not "localhost"', async () => {
    render(<QrPage />);
    const note = await screen.findByTestId('qr-network-note');
    expect(note).toHaveTextContent("Open this page on the restaurant's network address");
    expect(note).toHaveTextContent('not "localhost"');
  });
});

describe('loading and failure', () => {
  it('while loading it says so and Print is disabled', () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
    render(<QrPage />);
    expect(screen.getByTestId('qr-loading')).toBeInTheDocument();
    expect(screen.getByTestId('print-qr')).toBeDisabled();
  });

  it('"The tables could not be loaded. Try again." with Retry, and Retry works', async () => {
    let fail = true;
    fetchMock.mockImplementation(async () => (fail ? failed(500) : ok({ tables })));
    render(<QrPage />);
    expect(await screen.findByTestId('qr-error')).toHaveTextContent('The tables could not be loaded. Try again.');
    fail = false;
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByTestId('qr-table-1')).toBeInTheDocument();
  });
});
