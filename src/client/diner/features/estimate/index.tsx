// U6: the Cart's estimated wait (US9.1; BR3.1, BR3.2). Always labelled an estimate, never "0 min".
import React from 'react';
import { Banner } from '../../../components/ui/index.js';
import type { DinerFeatureProps } from '../types.js';
import { useEstimate } from './useEstimate.js';

export default function EstimateFeature({ tableId, events }: DinerFeatureProps) {
  const state = useEstimate(tableId, events);
  if (state.status === 'loading') return null;
  if (state.status === 'error') {
    return (
      <Banner tone="plain" icon={'⏱'} testId="wait-estimate">
        <strong>Estimate unavailable</strong>
        You can still place your order.
      </Banner>
    );
  }
  return (
    <Banner tone="info" icon={'⏱'} testId="wait-estimate">
      <strong>Estimated wait: about {state.minutes} min</strong>
      Estimate, based on today's orders and how busy the kitchen is right now.
    </Banner>
  );
}
