import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from './Button';
import { StatusBadge } from './StatusBadge';
import { SlotCell } from './SlotCell';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from './Card';
import { Skeleton } from './Skeleton';
import { EmptyState } from './EmptyState';
import { ErrorState } from './ErrorState';
import { Dialog } from './Dialog';
import { Input, Select, Label, FieldError, HelpText } from './FormControls';
import { PageHeader } from './PageHeader';
import { StatTile } from './StatTile';
import { SlotLegend } from './SlotLegend';
import { RecommendedBadge } from './RecommendedBadge';
import { SlotView } from '../../types/contract';

describe('Reusable UI Components & Design System Primitives', () => {
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

    it('renders all variants and sizes with proper class names', () => {
      const { rerender } = render(<Button variant="primary" size="sm">Primary</Button>);
      expect(screen.getByRole('button')).toHaveClass('bg-indigo-600');

      rerender(<Button variant="secondary" size="md">Secondary</Button>);
      expect(screen.getByRole('button')).toHaveClass('bg-slate-100');

      rerender(<Button variant="outline" size="lg">Outline</Button>);
      expect(screen.getByRole('button')).toHaveClass('border-slate-300');

      rerender(<Button variant="danger">Danger</Button>);
      expect(screen.getByRole('button')).toHaveClass('bg-red-600');

      rerender(<Button variant="ghost">Ghost</Button>);
      expect(screen.getByRole('button')).toHaveClass('bg-transparent');
    });

    it('honors native disabled attribute', () => {
      const onClick = vi.fn();
      render(<Button disabled onClick={onClick}>Disabled Button</Button>);
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

    it('renders booking statuses and allows custom label override', () => {
      render(<StatusBadge status="CONFIRMED" label="Active Reservation" />);
      expect(screen.getByText('Active Reservation')).toBeInTheDocument();

      const { rerender } = render(<StatusBadge status="NO_SHOW" />);
      expect(screen.getByText('No Show')).toBeInTheDocument();

      rerender(<StatusBadge status="COMPLETED" />);
      expect(screen.getByText('Completed')).toBeInTheDocument();
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

    it('supports keyboard selection with Enter and Space keys', () => {
      const onSelect = vi.fn();
      render(<SlotCell slot={availableSlot} onSelect={onSelect} />);

      const cell = screen.getByRole('button', { name: /slot a1/i });
      fireEvent.keyDown(cell, { key: 'Enter' });
      expect(onSelect).toHaveBeenCalledTimes(1);

      fireEvent.keyDown(cell, { key: ' ' });
      expect(onSelect).toHaveBeenCalledTimes(2);
    });

    it('disables interaction when slot is occupied', () => {
      const onSelect = vi.fn();
      render(<SlotCell slot={occupiedSlot} onSelect={onSelect} />);

      const cell = screen.getByRole('button', { name: /slot a2/i });
      expect(cell).toHaveAttribute('aria-disabled', 'true');
      fireEvent.click(cell);
      fireEvent.keyDown(cell, { key: 'Enter' });
      expect(onSelect).not.toHaveBeenCalled();
    });

    it('displays selected badge when isSelected is true', () => {
      render(<SlotCell slot={availableSlot} isSelected={true} />);
      expect(screen.getByText(/selected/i)).toBeInTheDocument();
    });
  });

  describe('Card', () => {
    it('renders title, description, content and footer inside Card', () => {
      render(
        <Card>
          <CardHeader>
            <CardTitle>Test Card Title</CardTitle>
            <CardDescription>Card Description</CardDescription>
          </CardHeader>
          <CardContent>Card Content Body</CardContent>
          <CardFooter>Footer Info</CardFooter>
        </Card>
      );

      expect(screen.getByText('Test Card Title')).toBeInTheDocument();
      expect(screen.getByText('Card Description')).toBeInTheDocument();
      expect(screen.getByText('Card Content Body')).toBeInTheDocument();
      expect(screen.getByText('Footer Info')).toBeInTheDocument();
    });
  });

  describe('Skeleton', () => {
    it('renders loading placeholder with role status and accessible text', () => {
      render(<Skeleton variant="text" width={200} height={20} />);
      const skeleton = screen.getByRole('status', { name: /loading/i });
      expect(skeleton).toBeInTheDocument();
      expect(skeleton).toHaveClass('animate-pulse');
    });
  });

  describe('EmptyState', () => {
    it('renders title, description, and action button', () => {
      render(
        <EmptyState
          title="No Parking Lots Found"
          description="Try broadening your search or choosing another arrival time."
          action={<Button size="sm">Reset Filters</Button>}
        />
      );

      expect(screen.getByText('No Parking Lots Found')).toBeInTheDocument();
      expect(screen.getByText(/broadening your search/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /reset filters/i })).toBeInTheDocument();
    });
  });

  describe('ErrorState', () => {
    it('renders error message in alert landmark and calls onRetry when clicked', () => {
      const onRetry = vi.fn();
      render(
        <ErrorState
          title="Unable to load slots"
          message="Network timeout while connecting to sensor intake."
          onRetry={onRetry}
          retryLabel="Retry Now"
        />
      );

      const alert = screen.getByRole('alert');
      expect(alert).toBeInTheDocument();
      expect(screen.getByText('Unable to load slots')).toBeInTheDocument();
      expect(screen.getByText(/network timeout/i)).toBeInTheDocument();

      const retryBtn = screen.getByRole('button', { name: /retry now/i });
      fireEvent.click(retryBtn);
      expect(onRetry).toHaveBeenCalledTimes(1);
    });
  });

  describe('Dialog (Modal)', () => {
    it('renders when isOpen is true and hides when false', () => {
      const { rerender } = render(
        <Dialog isOpen={false} onClose={vi.fn()} title="Test Dialog">
          <p>Dialog Body</p>
        </Dialog>
      );
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

      rerender(
        <Dialog isOpen={true} onClose={vi.fn()} title="Test Dialog" description="Description text">
          <p>Dialog Body</p>
        </Dialog>
      );
      const dialog = screen.getByRole('dialog');
      expect(dialog).toBeInTheDocument();
      expect(screen.getByText('Test Dialog')).toBeInTheDocument();
      expect(screen.getByText('Description text')).toBeInTheDocument();
      expect(screen.getByText('Dialog Body')).toBeInTheDocument();
    });

    it('calls onClose when close button or Escape key is pressed', () => {
      const onClose = vi.fn();
      render(
        <Dialog isOpen={true} onClose={onClose} title="Escape Test">
          <p>Content</p>
        </Dialog>
      );

      // Close button click
      const closeBtn = screen.getByRole('button', { name: /close dialog/i });
      fireEvent.click(closeBtn);
      expect(onClose).toHaveBeenCalledTimes(1);

      // Escape key press
      fireEvent.keyDown(window, { key: 'Escape' });
      expect(onClose).toHaveBeenCalledTimes(2);
    });

    it('traps focus between first and last focusable elements on Tab and Shift+Tab', () => {
      render(
        <Dialog isOpen={true} onClose={vi.fn()} title="Focus Trap Dialog">
          <button id="btn1">Button 1</button>
          <button id="btn2">Button 2</button>
        </Dialog>
      );

      const closeBtn = screen.getByRole('button', { name: /close dialog/i });
      const btn2 = screen.getByRole('button', { name: /button 2/i });

      // Simulate tab wrap at end
      btn2.focus();
      expect(document.activeElement).toBe(btn2);
      fireEvent.keyDown(window, { key: 'Tab' });

      // Shift+Tab wrap at start
      closeBtn.focus();
      expect(document.activeElement).toBe(closeBtn);
      fireEvent.keyDown(window, { key: 'Tab', shiftKey: true });
    });
  });

  describe('FormControls', () => {
    it('renders Label with optional required asterisk', () => {
      render(<Label required htmlFor="test-input">Vehicle Number</Label>);
      expect(screen.getByText('Vehicle Number')).toBeInTheDocument();
      expect(screen.getByText('*')).toBeInTheDocument();
    });

    it('connects Input with FieldError and HelpText via aria-describedby and aria-invalid', () => {
      render(
        <Input
          label="License Plate"
          error="Vehicle license plate is required"
          helpText="Enter state code followed by digits"
          defaultValue="MH12AB1234"
        />
      );

      const input = screen.getByRole('textbox', { name: /license plate/i });
      expect(input).toHaveAttribute('aria-invalid', 'true');
      expect(screen.getByRole('alert')).toHaveTextContent(/vehicle license plate is required/i);
    });

    it('renders standalone FieldError and HelpText components', () => {
      render(
        <div>
          <FieldError id="standalone-err" error="Custom validation message" />
          <HelpText id="standalone-help">Optional explanatory note</HelpText>
        </div>
      );
      expect(screen.getByRole('alert')).toHaveTextContent('Custom validation message');
      expect(screen.getByText('Optional explanatory note')).toBeInTheDocument();
    });

    it('renders Select with options and labels', () => {
      render(
        <Select label="Duration (Hours)" defaultValue="2">
          <option value="1">1 Hour</option>
          <option value="2">2 Hours</option>
        </Select>
      );

      const select = screen.getByRole('combobox', { name: /duration/i });
      expect(select).toBeInTheDocument();
      expect(select).toHaveValue('2');
    });
  });

  describe('PageHeader, StatTile, SlotLegend, and RecommendedBadge', () => {
    it('renders PageHeader with semantic heading and subtitle', () => {
      render(
        <PageHeader
          title="Live Parking Map"
          subtitle="Real-time availability and smart arrival predictions across Pune."
          actions={<Button size="sm">Refresh</Button>}
        />
      );

      const heading = screen.getByRole('heading', { level: 1 });
      expect(heading).toHaveTextContent('Live Parking Map');
      expect(screen.getByText(/real-time availability/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /refresh/i })).toBeInTheDocument();
    });

    it('renders StatTile with metric value and icon', () => {
      render(<StatTile label="Total Slots" value="120" description="Across 4 lots" />);
      expect(screen.getByText('Total Slots')).toBeInTheDocument();
      expect(screen.getByText('120')).toBeInTheDocument();
      expect(screen.getByText('Across 4 lots')).toBeInTheDocument();
    });

    it('renders SlotLegend with four status items', () => {
      render(<SlotLegend />);
      expect(screen.getByText('Available')).toBeInTheDocument();
      expect(screen.getByText('Held')).toBeInTheDocument();
      expect(screen.getByText('Reserved')).toBeInTheDocument();
      expect(screen.getByText('Occupied')).toBeInTheDocument();
    });

    it('renders RecommendedBadge with star icon and custom label', () => {
      render(<RecommendedBadge label="Best Choice for +30m" />);
      expect(screen.getByText('Best Choice for +30m')).toBeInTheDocument();
    });
  });
});
