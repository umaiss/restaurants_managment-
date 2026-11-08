/**
 * One station's board by link, for example /staff/stations/Grill (U7 Step 12). It shows the same station board
 * as the station tabs of the Kitchen Board, read from the same route (BR1.1, BR1.2).
 */
import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { useStaffSSE } from '../../../hooks/useStaffSSE';
import StationBoard from '../../board/StationBoard';
import { STATION_NAMES, type StationName } from '../../board/constants';
import '../../staff-u7.css';

export default function StationPage() {
  const { station } = useParams<{ station: string }>();
  const { events, connected } = useStaffSSE();
  const known = (STATION_NAMES as readonly string[]).includes(station ?? '');

  return (
    <section data-testid="station-page" className="stack" style={{ gap: 'var(--space-4)' }}>
      <div className="page-head">
        <div>
          <h1 style={{ margin: 0 }}>{known ? `${station} station` : 'Station'}</h1>
          <div className="u7-live" style={{ marginTop: 4 }}>
            Updated live
          </div>
        </div>
        <Link to="/staff" className="btn btn-sm">
          ← Kitchen Board
        </Link>
      </div>
      {known ? (
        <StationBoard station={station as StationName} events={events} connected={connected} />
      ) : (
        <p role="alert" data-testid="station-unknown">
          There is no station called "{station}". The stations are {STATION_NAMES.join(', ')}.
        </p>
      )}
    </section>
  );
}
