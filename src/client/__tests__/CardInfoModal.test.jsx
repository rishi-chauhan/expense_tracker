/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CardInfoModal from '../components/CardInfoModal';

describe('CardInfoModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders detected values and transaction count', () => {
    render(
      <CardInfoModal
        detected={{ bankName: 'HDFC', cardLast4: '1234' }}
        transactionCount={42}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    expect(screen.getByRole('heading', { name: 'Which card is this?' })).toBeInTheDocument();
    expect(screen.getByDisplayValue('HDFC')).toBeInTheDocument();
    expect(screen.getByDisplayValue('1234')).toBeInTheDocument();
    expect(screen.getByText(/42 transactions found/)).toBeInTheDocument();
  });

  it('calls onConfirm with trimmed values when valid', async () => {
    const onConfirm = vi.fn();
    const user = userEvent.setup();

    render(
      <CardInfoModal
        detected={{}}
        transactionCount={0}
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />
    );

    await user.type(screen.getByLabelText(/Bank name/), 'ICICI');
    await user.type(screen.getByLabelText(/Last 4 digits/), '9876');
    await user.click(screen.getByRole('button', { name: 'Upload' }));

    expect(onConfirm).toHaveBeenCalledWith({
      bankName: 'ICICI',
      cardLast4: '9876',
      cardLabel: null,
    });
  });

  it('calls onCancel when the backdrop is clicked', async () => {
    const onCancel = vi.fn();
    const user = userEvent.setup();

    const { container } = render(
      <CardInfoModal
        detected={{}}
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />
    );

    // A click whose target is the <dialog> element itself is a backdrop click
    await user.click(container.ownerDocument.querySelector('dialog'));
    expect(onCancel).toHaveBeenCalled();
  });

  it('calls onCancel when Escape is pressed', async () => {
    const onCancel = vi.fn();
    const user = userEvent.setup();
    render(<CardInfoModal detected={{}} onConfirm={vi.fn()} onCancel={onCancel} />);

    await user.keyboard('{Escape}');

    expect(onCancel).toHaveBeenCalled();
  });
});
