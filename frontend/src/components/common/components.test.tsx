import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from './Button';
import { StatusBadge } from './StatusBadge';
import { SlotCell } from './SlotCell';
import { Card, CardHeader, CardTitle, CardContent } from './Card';
import { SlotView } from '../../types/contract';

describe('Reusable UI Components', () => {
  describe('Button', () => {
    it('renders with children and responds to click', () => {
      const onClick = vi.fn();
      render(<Button onClick={onClick}>Click Me</Button>);
      const btn = screen.getByRole('button', { name: /click me/i });
      expect(btn).toBeInTheDocument();
      fireEvent.click(btn);
      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('disables button when isLoading is true', () => {
      const onClick = vi.fn();
      render(
        <Button isLoading onClick={onClick}>
          Submitting
        </Button>
      );
      const btn = screen.getByRole('button');
      expect(btn).toBeDisabled();
      fireEvent.click(btn);
      expect(onClick).not.toHaveBeenCalled();
    });
  });

  describe('StatusBadge', () => {
    it('renders AVAILABLE badge with icon and label', () => {
      render(<StatusBadge status="AVAILABLE" />);
      expect(screen.getByText('Available')).toBeInTheDocument();
    });

    it('renders HELD badge with icon and label', () => {
      render(<StatusBadge status="HELD" />);
      expect(screen.getByText('Held (5m)')).toBeInTheDocument();
    });

    it('renders RESERVED badge with icon and label', () => {
      render(<StatusBadge status="RESERVED" />);
      expect(screen.getByText('Reserved')).toBeInTheDocument();
    });

    it('renders OCCUPIED badge with icon and label', () => {
      render(<StatusBadge status="OCCUPIED" />);
      expect(screen.getByText('Occupied')).toBeInTheDocument();
    });
  });

  describe('SlotCell', () => {
    const availableSlot: SlotView = {
      id: 'slot-1',
      slotNumber: 'A1',
      status: 'AVAILABLE',
    };

    const occupiedSlot: SlotView = {
      id: 'slot-2',
      slotNumber: 'A2',
      status: 'OCCUPIED',
    };

    it('renders slot number and allows selection when available', () => {
      const onSelect = vi.fn();
      render(<SlotCell slot={availableSlot} onSelect={onSelect} />);

      expect(screen.getByText('A1')).toBeInTheDocument();
      const cell = screen.getByRole('button', { name: /slot a1/i });
      fireEvent.click(cell);
      expect(onSelect).toHaveBeenCalledWith(availableSlot);
    });

    it('disables interaction when slot is occupied', () => {
      const onSelect = vi.fn();
      render(<SlotCell slot={occupiedSlot} onSelect={onSelect} />);

      const cell = screen.getByRole('button', { name: /slot a2/i });
      expect(cell).toHaveAttribute('aria-disabled', 'true');
      fireEvent.click(cell);
      expect(onSelect).not.toHaveBeenCalled();
    });

    it('displays selected badge when isSelected is true', () => {
      render(<SlotCell slot={availableSlot} isSelected={true} />);
      expect(screen.getByText(/selected/i)).toBeInTheDocument();
    });
  });

  describe('Card', () => {
    it('renders title and content inside Card', () => {
      render(
        <Card>
          <CardHeader>
            <CardTitle>Test Card Title</CardTitle>
          </CardHeader>
          <CardContent>Card Content Body</CardContent>
        </Card>
      );

      expect(screen.getByText('Test Card Title')).toBeInTheDocument();
      expect(screen.getByText('Card Content Body')).toBeInTheDocument();
    });
  });
});
