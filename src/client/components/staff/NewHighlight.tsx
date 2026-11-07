import React from 'react';

interface NewHighlightProps {
  active: boolean;
  children: React.ReactNode;
}

const styles = `
.new-highlight-active {
  border-radius: 0.5rem;
  box-shadow: 0 0 0 2px var(--accent, #f59e0b), 0 0 12px 2px rgba(245, 158, 11, 0.35);
  transition: box-shadow 150ms ease-out;
  animation: newGlow 2.4s ease-in-out infinite;
}

.new-highlight-inactive {
  border-radius: 0.5rem;
  box-shadow: 0 0 0 0px transparent, 0 0 0px 0px transparent;
  transition: box-shadow 150ms ease-out;
}

@media (prefers-reduced-motion: reduce) {
  .new-highlight-active,
  .new-highlight-inactive {
    transition: none;
  }
}

.new-highlight-label {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.7rem;
  font-weight: 700;
  color: var(--accent, #f59e0b);
  letter-spacing: 0.04em;
  margin-bottom: 0.25rem;
}
`;

// Inject styles once
let stylesInjected = false;
function injectStyles() {
  if (stylesInjected || typeof document === 'undefined') return;
  const tag = document.createElement('style');
  tag.textContent = styles;
  document.head.appendChild(tag);
  stylesInjected = true;
}

export default function NewHighlight({ active, children }: NewHighlightProps) {
  injectStyles();

  return (
    <div
      data-testid="new-highlight"
      data-active={active}
      className={active ? 'new-highlight-active' : 'new-highlight-inactive'}
    >
      {active && (
        <div className="new-highlight-label" aria-label="New order">
          ★ New
        </div>
      )}
      {children}
    </div>
  );
}
