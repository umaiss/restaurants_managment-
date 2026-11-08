// U5 Step 12: the shared components (BR10.1, BR10.4, BR10.5, NFR6).
import React, { useState } from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import {
  Button, AddPill, Pill, Chip, Badge, Timer, Banner, Sheet, Field, SegmentedControl, Tracker, SideNav,
} from '../index.js';

afterEach(cleanup);

describe('Button and AddPill', () => {
  it('renders a design-system button of type button, with variant classes', () => {
    render(<><Button>Plain</Button><Button variant="primary" small>Go</Button><Button variant="danger">Cancel</Button><Button variant="ghost">Skip</Button></>);
    expect(screen.getByText('Plain')).toHaveClass('btn');
    expect(screen.getByText('Plain')).toHaveAttribute('type', 'button');
    expect(screen.getByText('Go')).toHaveClass('btn', 'btn-primary', 'btn-sm');
    expect(screen.getByText('Cancel')).toHaveClass('btn-danger');
    expect(screen.getByText('Skip')).toHaveClass('btn-ghost');
  });

  it('calls onClick, and a disabled button does not', async () => {
    const onClick = vi.fn();
    render(<><Button onClick={onClick}>Press</Button><Button disabled onClick={onClick}>Off</Button></>);
    await userEvent.click(screen.getByText('Press'));
    await userEvent.click(screen.getByText('Off'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('lets a screen set its own test id, and defaults to ui-button', () => {
    render(<><Button>A</Button><Button data-testid="mine">B</Button></>);
    expect(screen.getByText('A')).toHaveAttribute('data-testid', 'ui-button');
    expect(screen.getByTestId('mine')).toBeInTheDocument();
  });

  it('the add pill is the small "+ Add" pill', () => {
    render(<AddPill>+ Add</AddPill>);
    expect(screen.getByRole('button', { name: '+ Add' })).toHaveClass('add-pill');
  });
});

describe('Pill, Chip and Badge', () => {
  it('a pill is filled in and aria-current only when active', () => {
    render(<><Pill active>Mains</Pill><Pill>Drinks</Pill></>);
    expect(screen.getByText('Mains')).toHaveClass('pill', 'active');
    expect(screen.getByText('Mains')).toHaveAttribute('aria-current', 'true');
    expect(screen.getByText('Drinks')).not.toHaveAttribute('aria-current');
  });

  it('a chip announces whether it is pressed', async () => {
    function Demo() {
      const [on, setOn] = useState(false);
      return <Chip pressed={on} onClick={() => setOn(!on)}>Gluten</Chip>;
    }
    render(<Demo />);
    const chip = screen.getByRole('button', { name: 'Gluten' });
    expect(chip).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(chip);
    expect(chip).toHaveAttribute('aria-pressed', 'true');
  });

  it.each(['pending', 'preparing', 'completed', 'cancelled', 'danger', 'accent'] as const)('a %s badge carries its word and its tone class', (tone) => {
    render(<Badge tone={tone}>{tone} word</Badge>);
    const badge = screen.getByText(`${tone} word`);
    expect(badge).toHaveClass('badge', `badge-${tone}`);
  });
});

describe('Timer', () => {
  it('is green by default and amber or red on request, with the words inside', () => {
    render(<><Timer>5 min</Timer><Timer tone="amber">Slow</Timer><Timer tone="red">Late</Timer></>);
    expect(screen.getByText('5 min')).toHaveClass('timer');
    expect(screen.getByText('5 min')).not.toHaveClass('amber', 'red');
    expect(screen.getByText('Slow')).toHaveClass('timer', 'amber');
    expect(screen.getByText('Late')).toHaveClass('timer', 'red');
    expect(screen.getByText('Late')).toHaveAttribute('data-tone', 'red');
  });
});

describe('Banner', () => {
  it('shows a title, text and a symbol hidden from screen readers', () => {
    render(<Banner tone="success" icon="✓" title="Order #5 is ready">Come and get it</Banner>);
    const banner = screen.getByTestId('ui-banner');
    expect(banner).toHaveClass('banner', 'banner-success');
    expect(banner).toHaveTextContent('Order #5 is ready');
    expect(banner).toHaveTextContent('Come and get it');
    expect(screen.getByText('✓')).toHaveAttribute('aria-hidden', 'true');
  });

  it('warn and danger banners are announced as alerts, the others as status', () => {
    render(<><Banner tone="danger" testId="d" /><Banner tone="warn" testId="w" /><Banner tone="info" testId="i" /><Banner testId="p" /></>);
    expect(screen.getByTestId('d')).toHaveAttribute('role', 'alert');
    expect(screen.getByTestId('w')).toHaveAttribute('role', 'alert');
    expect(screen.getByTestId('i')).toHaveAttribute('role', 'status');
    expect(screen.getByTestId('p')).toHaveAttribute('role', 'status');
  });

  it('has a Dismiss button only when it can be dismissed', async () => {
    const onDismiss = vi.fn();
    const { rerender } = render(<Banner title="x" />);
    expect(screen.queryByRole('button', { name: 'Dismiss' })).toBeNull();
    rerender(<Banner title="x" onDismiss={onDismiss} />);
    await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});

describe('Sheet', () => {
  it('renders nothing while closed', () => {
    render(<Sheet open={false} title="Settings" onClose={() => undefined} />);
    expect(screen.queryByTestId('ui-sheet')).toBeNull();
  });

  it('is a modal dialog named by its title, with focus moved inside', () => {
    render(<Sheet open title="Settings" onClose={() => undefined}><button>First</button><button>Second</button></Sheet>);
    const dialog = screen.getByRole('dialog', { name: 'Settings' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument();
    expect(dialog.contains(document.activeElement)).toBe(true);
  });

  it('Escape and a tap on the scrim close it; a tap inside does not', async () => {
    const onClose = vi.fn();
    render(<Sheet open title="Settings" onClose={onClose}><button>Inside</button></Sheet>);
    await userEvent.click(screen.getByText('Inside'));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByTestId('ui-sheet-scrim'));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('keeps Tab inside the sheet and gives focus back to what opened it', async () => {
    function Demo() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button onClick={() => setOpen(true)}>Open</button>
          <Sheet open={open} title="Settings" onClose={() => setOpen(false)}><button>One</button><button>Two</button></Sheet>
        </>
      );
    }
    render(<Demo />);
    const opener = screen.getByText('Open');
    opener.focus();
    await userEvent.click(opener);
    expect(document.activeElement).toBe(screen.getByText('One'));
    await userEvent.tab();
    expect(document.activeElement).toBe(screen.getByText('Two'));
    await userEvent.tab(); // past the last one: back to the first, not out of the sheet
    expect(document.activeElement).toBe(screen.getByText('One'));
    await userEvent.tab({ shift: true });
    expect(document.activeElement).toBe(screen.getByText('Two'));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(document.activeElement).toBe(opener);
  });
});

describe('Field', () => {
  it('ties the label to its control and shows help and an announced error', () => {
    render(<Field label="PIN" htmlFor="pin" help="4 digits" error="Too short"><input id="pin" /></Field>);
    expect(screen.getByLabelText('PIN')).toBeInTheDocument();
    expect(screen.getByText('4 digits')).toHaveClass('help');
    expect(screen.getByRole('alert')).toHaveTextContent('Too short');
  });

  it('has no help or error text when none is given', () => {
    render(<Field label="Name" htmlFor="name"><input id="name" /></Field>);
    expect(screen.queryByRole('alert')).toBeNull();
    expect(document.querySelector('.help')).toBeNull();
  });
});

describe('SegmentedControl', () => {
  const options = [
    { value: 'device', label: 'Follow device' },
    { value: 'light', label: 'Light' },
    { value: 'dark', label: 'Dark' },
  ] as const;

  it('marks the chosen segment aria-pressed and calls onChange with the new value', async () => {
    const onChange = vi.fn();
    render(<SegmentedControl ariaLabel="Theme" options={[...options]} value="light" onChange={onChange} />);
    expect(screen.getByRole('group', { name: 'Theme' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Light' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Dark' })).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(screen.getByRole('button', { name: 'Dark' }));
    expect(onChange).toHaveBeenCalledWith('dark');
  });

  it('gives each segment a test id built from the control\'s', () => {
    render(<SegmentedControl ariaLabel="Theme" testId="theme" options={[...options]} value="device" onChange={() => undefined} />);
    expect(screen.getByTestId('theme-dark')).toHaveTextContent('Dark');
  });
});

describe('Tracker', () => {
  it('marks steps before the current one done, the current one current, and names every step', () => {
    render(<Tracker steps={['Pending', 'Preparing', 'Completed']} current={1} />);
    const steps = screen.getAllByRole('listitem');
    expect(steps.map((s) => s.textContent)).toEqual(['Pending', 'Preparing', 'Completed']);
    expect(steps[0]).toHaveClass('done');
    expect(steps[1]).toHaveClass('current');
    expect(steps[1]).toHaveAttribute('aria-current', 'step');
    expect(steps[2]).not.toHaveClass('done', 'current');
    expect(steps.map((s) => s.getAttribute('data-state'))).toEqual(['done', 'current', 'coming']);
  });

  it('with no step reached every step is coming', () => {
    render(<Tracker steps={['A', 'B']} current={-1} />);
    expect(screen.getAllByRole('listitem').map((s) => s.getAttribute('data-state'))).toEqual(['coming', 'coming']);
  });
});

describe('SideNav', () => {
  const items = [
    { key: 'board', to: '/staff', label: 'Kitchen Board', icon: '🍳', end: true },
    { key: 'floor', to: '/staff/floor', label: 'Floor map' },
  ];

  it('lists every page and marks the current one aria-current="page"', () => {
    render(<MemoryRouter initialEntries={['/staff/floor']}><SideNav items={items} footer={<button>Sign out</button>} /></MemoryRouter>);
    expect(screen.getByRole('navigation', { name: 'Staff navigation' })).toBeInTheDocument();
    expect(screen.getByTestId('nav-floor')).toHaveAttribute('aria-current', 'page');
    expect(screen.getByTestId('nav-board')).not.toHaveAttribute('aria-current');
    expect(screen.getByText('Sign out')).toBeInTheDocument();
  });

  it('the index page is current only on its exact path', () => {
    render(<MemoryRouter initialEntries={['/staff']}><SideNav items={items} /></MemoryRouter>);
    expect(screen.getByTestId('nav-board')).toHaveAttribute('aria-current', 'page');
    expect(screen.getByTestId('nav-floor')).not.toHaveAttribute('aria-current');
  });

  it('calls onNavigate when a link is followed', async () => {
    const onNavigate = vi.fn();
    render(<MemoryRouter><SideNav items={items} onNavigate={onNavigate} /></MemoryRouter>);
    await userEvent.click(screen.getByTestId('nav-floor'));
    expect(onNavigate).toHaveBeenCalledTimes(1);
  });
});
