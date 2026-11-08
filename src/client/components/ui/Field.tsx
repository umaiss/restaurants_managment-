import React from 'react';

export interface FieldProps {
  label: string;
  /** The id of the control inside, so the label is tied to it. */
  htmlFor: string;
  help?: string;
  error?: string;
  children: React.ReactNode;
}

/** A labelled form field (.field): label, control, help text, and an error that is announced. */
export function Field({ label, htmlFor, help, error, children }: FieldProps) {
  return (
    <div className="field" data-testid={`field-${htmlFor}`}>
      <label htmlFor={htmlFor}>{label}</label>
      {children}
      {help && <span className="help">{help}</span>}
      {error && (
        <span className="error-text" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
