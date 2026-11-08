import React from 'react';

/** The placeholder every staff page starts as. U7 replaces a page's own file and never edits the registry. */
export default function PagePlaceholder({ title }: { title: string }) {
  return (
    <section data-testid="page-placeholder" className="card stack">
      <h1 style={{ margin: 0 }}>{title}</h1>
      <p className="secondary" style={{ margin: 0 }}>
        This page is not built yet.
      </p>
    </section>
  );
}
