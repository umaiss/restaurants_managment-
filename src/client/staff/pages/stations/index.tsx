// U7 owns this file (one station's board, for example /staff/stations/Grill). U5 ships the placeholder (BR14.2).
import React from 'react';
import { useParams } from 'react-router-dom';
import PagePlaceholder from '../PagePlaceholder.js';

export default function StationPage() {
  const { station } = useParams<{ station: string }>();
  return <PagePlaceholder title={`${station ?? 'Station'} station`} />;
}
