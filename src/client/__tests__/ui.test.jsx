/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Amount, { HIDDEN_AMOUNT } from '../components/ui/Amount';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import SegmentedControl from '../components/ui/SegmentedControl';
import { ToastProvider, useToast } from '../components/ui/Toast';
import { SettingsProvider, useSettings } from '../contexts/SettingsContext';
import { setSettings } from './testUtils';

function PrivacyToggle() {
  const { toggleHideAmounts } = useSettings();
  return <button type="button" onClick={toggleHideAmounts}>toggle</button>;
}

describe('Amount', () => {
  it('formats INR with tabular figures', () => {
    render(<SettingsProvider><Amount value={123456.78} /></SettingsProvider>);
    const el = screen.getByText('₹1,23,456.78');
    expect(el).toHaveClass('amount');
  });

  it('supports whole, compact and signed credit variants', () => {
    render(
      <SettingsProvider>
        <Amount value={123456.78} whole />
        <Amount value={120000} compact />
        <Amount value={50} credit sign tone="auto" />
      </SettingsProvider>
    );
    expect(screen.getByText('₹1,23,457')).toBeInTheDocument();
    expect(screen.getByText('₹1.2L')).toBeInTheDocument();
    expect(screen.getByText('+₹50.00')).toHaveClass('is-credit');
  });

  it('hides values in privacy mode', async () => {
    const user = userEvent.setup();
    render(<SettingsProvider><Amount value={999} /><PrivacyToggle /></SettingsProvider>);
    expect(screen.getByText('₹999.00')).toBeInTheDocument();
    await user.click(screen.getByText('toggle'));
    expect(screen.queryByText('₹999.00')).not.toBeInTheDocument();
    expect(screen.getByLabelText('hidden amount')).toHaveTextContent(HIDDEN_AMOUNT);
  });

  it('starts hidden when persisted', () => {
    setSettings({ showCredits: false, hideAmounts: true });
    render(<SettingsProvider><Amount value={5} /></SettingsProvider>);
    expect(screen.getByLabelText('hidden amount')).toBeInTheDocument();
  });

  it('Shift+H toggles privacy except while typing', () => {
    render(<SettingsProvider><Amount value={7} /><input aria-label="field" /></SettingsProvider>);
    fireEvent.keyDown(screen.getByLabelText('field'), { key: 'H', shiftKey: true });
    expect(screen.getByText('₹7.00')).toBeInTheDocument();
    fireEvent.keyDown(document.body, { key: 'H', shiftKey: true });
    expect(screen.getByLabelText('hidden amount')).toBeInTheDocument();
  });
});

function ToastButtons() {
  const { show } = useToast();
  return (
    <>
      <button type="button" onClick={() => show({ type: 'success', title: 'Saved', message: 'All good' })}>ok</button>
      <button type="button" onClick={() => show({ type: 'error', title: 'Broken', message: 'Fix it' })}>err</button>
    </>
  );
}

describe('ToastProvider', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('auto-dismisses success toasts after 5 s with role=status', () => {
    render(<ToastProvider><ToastButtons /></ToastProvider>);
    fireEvent.click(screen.getByText('ok'));
    expect(screen.getByRole('status')).toHaveTextContent('Saved');
    act(() => { vi.advanceTimersByTime(5100); });
    expect(screen.queryByText('Saved')).not.toBeInTheDocument();
  });

  it('keeps error toasts (role=alert) until dismissed', () => {
    render(<ToastProvider><ToastButtons /></ToastProvider>);
    fireEvent.click(screen.getByText('err'));
    act(() => { vi.advanceTimersByTime(20000); });
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Broken');
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss notification' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('ConfirmDialog', () => {
  it('confirms and cancels', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(<ConfirmDialog open title="Delete it?" message="Gone forever" confirmLabel="Delete" onConfirm={onConfirm} onCancel={onCancel} />);
    expect(screen.getByRole('dialog', { name: 'Delete it?' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onConfirm).toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalled();
  });

  it('renders nothing when closed', () => {
    const { container } = render(<ConfirmDialog open={false} title="x" message="y" onConfirm={() => {}} onCancel={() => {}} />);
    expect(container.innerHTML).toBe('');
  });
});

describe('SegmentedControl', () => {
  it('selects with click and arrow keys', () => {
    const onChange = vi.fn();
    const options = [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }];
    render(<SegmentedControl label="Pick" value="a" onChange={onChange} options={options} />);
    expect(screen.getByRole('radio', { name: 'A' })).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(screen.getByRole('radio', { name: 'B' }));
    expect(onChange).toHaveBeenLastCalledWith('b');
    fireEvent.keyDown(screen.getByRole('radiogroup'), { key: 'ArrowRight' });
    expect(onChange).toHaveBeenLastCalledWith('b');
  });
});
