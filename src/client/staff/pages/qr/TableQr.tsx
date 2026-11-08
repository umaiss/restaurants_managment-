/**
 * One table's QR code (U7 Step 12). Rules: BR8.1 (the code holds exactly <origin>/table/<number>), BR8.3 (drawn here
 * in the browser by the bundled `qrcode` package: nothing leaves the app, so it works with no internet). The code is
 * drawn as one SVG path from the package's own matrix; the text it holds is also on the element as data-qr-text,
 * which is what the tests read (the package has no reader, and none is added).
 */
import React, { useMemo } from 'react';
import QRCode from 'qrcode';
import '../../staff-u7.css';

/** The address a table's code holds (BR8.1): the page's origin, with no trailing slash, then /table/<number>. */
export function tableAddress(origin: string, tableId: number): string {
  return `${origin.replace(/\/+$/, '')}/table/${tableId}`;
}

/** The SVG path (one square per dark module) and the size of a code of `text`, with a 4-module quiet zone. */
export function qrPath(text: string): { d: string; size: number } {
  const qr = QRCode.create(text, { errorCorrectionLevel: 'M' });
  const n = qr.modules.size;
  const quiet = 4;
  let d = '';
  for (let row = 0; row < n; row++) {
    for (let col = 0; col < n; col++) {
      if (qr.modules.get(row, col)) d += `M${col + quiet} ${row + quiet}h1v1h-1z`;
    }
  }
  return { d, size: n + quiet * 2 };
}

export interface TableQrProps {
  tableId: number;
  label: string;
  origin: string;
}

export default function TableQr({ tableId, label, origin }: TableQrProps) {
  const text = tableAddress(origin, tableId);
  const drawn = useMemo(() => {
    try {
      return qrPath(text);
    } catch {
      return null; // an address too long for a code; the label and address below still show
    }
  }, [text]);

  return (
    <div className="u7-qr-card" data-testid={`qr-table-${tableId}`}>
      <div className="u7-qr" role="img" aria-label={`QR code for ${label}`} data-qr-text={text} data-testid={`qr-code-${tableId}`}>
        {drawn ? (
          <svg viewBox={`0 0 ${drawn.size} ${drawn.size}`} shapeRendering="crispEdges" aria-hidden="true" focusable="false">
            <path d={drawn.d} fill="currentColor" />
          </svg>
        ) : (
          <span>Code unavailable</span>
        )}
      </div>
      <strong>{label}</strong>
      <span className="url">/table/{tableId}</span>
    </div>
  );
}
