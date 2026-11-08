import React from 'react';

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

export interface SegmentedControlProps<T extends string> {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
  testId?: string;
}

/** A segmented control (.seg), for example Follow device / Light / Dark. The chosen segment is aria-pressed. */
export function SegmentedControl<T extends string>({ options, value, onChange, ariaLabel, testId = 'ui-segmented' }: SegmentedControlProps<T>) {
  return (
    <div className="seg" role="group" aria-label={ariaLabel} data-testid={testId}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          data-testid={`${testId}-${o.value}`}
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
