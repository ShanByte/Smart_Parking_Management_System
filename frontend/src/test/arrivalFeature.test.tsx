import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { AvailabilityBadge } from '../components/lot/AvailabilityBadge';
import { ArrivalTimeSelector } from '../components/lot/ArrivalTimeSelector';
import { AvailabilityPatternChart } from '../features/stats/AvailabilityPatternChart';
import { MapPage } from '../pages/MapPage';
import { api } from '../services/api';
import { ArrivalBand } from '@smart-parking/shared';

describe('Stage E2: Arrival Availability Feature Test Suite', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('AvailabilityBadge component rendering across all bands', () => {
    it('renders EXCELLENT band (>= 90%) with correct score, headline, and accessible label', () => {
      render(
        <AvailabilityBadge
          score={95}
          arrivalTimeLabel="7:00 PM"
        />
      );

      expect(screen.getByText('95%')).toBeInTheDocument();
      expect(screen.getByText(/Excellent chance of finding a space/i)).toBeInTheDocument();
      expect(screen.getByText(ArrivalBand.EXCELLENT)).toBeInTheDocument();
      expect(
        screen.getByText(/Estimate based on historical occupancy data. Not a guarantee./i)
      ).toBeInTheDocument();
      expect(
        screen.getByLabelText(/Estimated availability at 7:00 PM: 95 percent, excellent availability likelihood/i)
      ).toBeInTheDocument();
    });

    it('renders GOOD band (75-89%)', () => {
      render(<AvailabilityBadge score={80} arrivalTimeLabel="8:00 PM" />);
      expect(screen.getByText('80%')).toBeInTheDocument();
      expect(screen.getByText(/Good chance of finding a space/i)).toBeInTheDocument();
      expect(screen.getByText(ArrivalBand.GOOD)).toBeInTheDocument();
    });

    it('renders MODERATE band (50-74%)', () => {
      render(<AvailabilityBadge score={60} arrivalTimeLabel="8:00 PM" />);
      expect(screen.getByText('60%')).toBeInTheDocument();
      expect(screen.getByText(/Moderate chance of finding a space/i)).toBeInTheDocument();
      expect(screen.getByText(ArrivalBand.MODERATE)).toBeInTheDocument();
    });

    it('renders LOW band (25-49%)', () => {
      render(<AvailabilityBadge score={35} arrivalTimeLabel="8:00 PM" />);
      expect(screen.getByText('35%')).toBeInTheDocument();
      expect(screen.getByText(/Low chance of finding a space/i)).toBeInTheDocument();
      expect(screen.getByText(ArrivalBand.LOW)).toBeInTheDocument();
    });

    it('renders VERY_LOW band (< 25%)', () => {
      render(<AvailabilityBadge score={10} arrivalTimeLabel="8:00 PM" />);
      expect(screen.getByText('10%')).toBeInTheDocument();
      expect(screen.getByText(/Very low chance of finding a space/i)).toBeInTheDocument();
      expect(screen.getByText(ArrivalBand.VERY_LOW)).toBeInTheDocument();
    });

    it('renders LIMITED_DATA state honestly with no fake percentage and fallback text', () => {
      render(<AvailabilityBadge score={null} arrivalTimeLabel="9:00 PM" />);
      expect(screen.queryByText(/%/)).not.toBeInTheDocument();
      expect(screen.getByText(/Limited historical data/i)).toBeInTheDocument();
      expect(
        screen.getByLabelText(/Estimated availability at 9:00 PM: limited historical data/i)
      ).toBeInTheDocument();
    });

    it('renders Recommended badge and reason when isRecommended is true', () => {
      render(
        <AvailabilityBadge
          score={88}
          arrivalTimeLabel="7:00 PM"
          isRecommended={true}
          recommendedReason="88% estimated availability, 12 spaces free now"
        />
      );

      const recBadge = screen.getByTestId('recommended-badge');
      expect(recBadge).toBeInTheDocument();
      expect(recBadge).toHaveTextContent(/Recommended for 7:00 PM/i);
      expect(
        screen.getByText(/88% estimated availability, 12 spaces free now/i)
      ).toBeInTheDocument();
    });

    it('renders Most spaces badge when isMostSpacesNow is true', () => {
      render(
        <AvailabilityBadge
          score={null}
          arrivalTimeLabel="7:00 PM"
          isMostSpacesNow={true}
        />
      );

      const mostSpacesBadge = screen.getByTestId('most-spaces-badge');
      expect(mostSpacesBadge).toBeInTheDocument();
      expect(mostSpacesBadge).toHaveTextContent(/Most spaces right now/i);
    });
  });

  describe('ArrivalTimeSelector presets, custom validation, and geolocation', () => {
    it('renders presets and triggers onChange on selection', () => {
      const onChange = vi.fn();
      render(
        <ArrivalTimeSelector
          arrivalIso={new Date().toISOString()}
          onChange={onChange}
          userCoords={null}
          onLocationChange={vi.fn()}
        />
      );

      expect(screen.getByRole('button', { name: 'Now' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '+15 min' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '+30 min' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '+1 hour' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Custom' })).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: '+30 min' }));
      expect(onChange).toHaveBeenCalled();
      const calledIso = onChange.mock.calls[0][0];
      expect(typeof calledIso).toBe('string');
      expect(onChange.mock.calls[0][1]).toBe(false); // isNow = false
    });

    it('validates custom time range: rejects past dates with accessible error', () => {
      const onChange = vi.fn();
      render(
        <ArrivalTimeSelector
          arrivalIso={new Date().toISOString()}
          onChange={onChange}
          userCoords={null}
          onLocationChange={vi.fn()}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: 'Custom' }));
      const input = screen.getByLabelText(/Choose Custom Date & Time/i);
      expect(input).toBeInTheDocument();

      // Enter a past time
      const pastTime = new Date(Date.now() - 3600 * 1000 * 24).toISOString().slice(0, 16);
      fireEvent.change(input, { target: { value: pastTime } });

      const alert = screen.getByRole('alert');
      expect(alert).toHaveTextContent(/Arrival time cannot be in the past/i);
    });

    it('validates custom time range: rejects dates > 7 days ahead', () => {
      const onChange = vi.fn();
      render(
        <ArrivalTimeSelector
          arrivalIso={new Date().toISOString()}
          onChange={onChange}
          userCoords={null}
          onLocationChange={vi.fn()}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: 'Custom' }));
      const input = screen.getByLabelText(/Choose Custom Date & Time/i);

      // Enter a time 10 days ahead
      const farTime = new Date(Date.now() + 10 * 3600 * 1000 * 24).toISOString().slice(0, 16);
      fireEvent.change(input, { target: { value: farTime } });

      const alert = screen.getByRole('alert');
      expect(alert).toHaveTextContent(/cannot be more than 7 days ahead/i);
    });

    it('triggers geolocation only on tap of Near me and handles denial gracefully', () => {
      const onLocationChange = vi.fn();
      const getCurrentPositionMock = vi.fn((_, errorCb) => {
        errorCb({ code: 1, message: 'User denied geolocation' });
      });

      // Mock navigator.geolocation
      const originalGeo = navigator.geolocation;
      Object.defineProperty(navigator, 'geolocation', {
        value: {
          getCurrentPosition: getCurrentPositionMock,
        },
        writable: true,
      });

      render(
        <ArrivalTimeSelector
          arrivalIso={new Date().toISOString()}
          onChange={vi.fn()}
          userCoords={null}
          onLocationChange={onLocationChange}
        />
      );

      const nearMeBtn = screen.getByRole('button', { name: /near me/i });
      fireEvent.click(nearMeBtn);

      expect(getCurrentPositionMock).toHaveBeenCalled();
      expect(onLocationChange).toHaveBeenCalledWith(null);
      expect(screen.getByText(/Location unavailable/i)).toBeInTheDocument();

      // Restore
      Object.defineProperty(navigator, 'geolocation', { value: originalGeo, writable: true });
    });
  });

  describe('AvailabilityPatternChart text alternative & limited data handling', () => {
    const mockPattern = [
      { hourOfDay: 18, expectedAvailablePercent: 82 },
      { hourOfDay: 19, expectedAvailablePercent: 61 },
      { hourOfDay: 20, expectedAvailablePercent: 48 },
    ];

    it('renders plain summary and accessible text alternative', () => {
      render(
        <AvailabilityPatternChart
          pattern={mockPattern}
          arrivalHour={19}
          lotName="FC Road Parking"
        />
      );

      expect(
        screen.getAllByText(/Typically 82% free at 6 PM, 61% free at 7 PM, 48% free at 8 PM/i).length
      ).toBeGreaterThanOrEqual(1);
      expect(screen.getByRole('region', { name: /Availability pattern for FC Road Parking/i })).toBeInTheDocument();
    });

    it('renders clean fallback when isLimitedData is true', () => {
      render(
        <AvailabilityPatternChart
          pattern={[]}
          arrivalHour={19}
          isLimitedData={true}
        />
      );

      expect(screen.getByText(/Limited historical data/i)).toBeInTheDocument();
      expect(
        screen.getByText(/Hourly occupancy pattern is still accumulating for this location./i)
      ).toBeInTheDocument();
    });
  });

  describe('Realtime derivation and MapPage integration', () => {
    const mockLots = [
      {
        id: 'lot-fc',
        name: 'FC Road Parking',
        address: 'FC Road, Pune',
        latitude: 18.5204,
        longitude: 73.8567,
        totalSlots: 20,
        freeCount: 15,
        pricePerHourPaise: 4000,
      },
      {
        id: 'lot-kp',
        name: 'Koregaon Park Parking',
        address: 'KP, Pune',
        latitude: 18.5362,
        longitude: 73.894,
        totalSlots: 30,
        freeCount: 5,
        pricePerHourPaise: 5000,
      },
    ];

    const mockAvailability = {
      arrivalTime: new Date().toISOString(),
      generatedAt: new Date().toISOString(),
      lots: [
        {
          parkingLotId: 'lot-fc',
          totalSlots: 20,
          historical: {
            status: 'OK' as const,
            basis: 'ALL_DAYS_HOUR' as const,
            samples: 7,
            expectedAvailablePercentAtArrival: 85,
            expectedAvailablePercentNow: 75,
          },
          pattern: [
            { hourOfDay: 14, expectedAvailablePercent: 85 },
            { hourOfDay: 15, expectedAvailablePercent: 80 },
          ],
        },
        {
          parkingLotId: 'lot-kp',
          totalSlots: 30,
          historical: {
            status: 'OK' as const,
            basis: 'ALL_DAYS_HOUR' as const,
            samples: 7,
            expectedAvailablePercentAtArrival: 40,
            expectedAvailablePercentNow: 30,
          },
          pattern: [
            { hourOfDay: 14, expectedAvailablePercent: 40 },
          ],
        },
      ],
    };

    it('renders MapPage, marks eligible lot as recommended, and recalculates on cache update without refetch', async () => {
      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      });

      const getSpy = vi.spyOn(api, 'get').mockImplementation(async (url: string) => {
        if (url === '/parking-lots') {
          return { data: { success: true, data: mockLots } };
        }
        if (url.includes('/availability/arrival')) {
          return { data: { success: true, data: mockAvailability } };
        }
        return { data: { success: true, data: null } };
      });

      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <MapPage />
          </MemoryRouter>
        </QueryClientProvider>
      );

      // Verify lots and Recommended badge
      await waitFor(() => {
        expect(screen.getByText('FC Road Parking')).toBeInTheDocument();
      });

      await waitFor(() => {
        expect(screen.getByTestId('recommended-badge')).toBeInTheDocument();
      });

      const initialApiCalls = getSpy.mock.calls.length;

      // Simulate a real-time WebSocket update: updating freeCount of FC Road in the query cache
      queryClient.setQueryData(['parking-lots'], (prevLots: typeof mockLots) => {
        return prevLots.map((l) =>
          l.id === 'lot-fc' ? { ...l, freeCount: 18 } : l
        );
      });

      // Verify that the UI reflects 18 Free immediately
      await waitFor(() => {
        expect(screen.getByText(/18 \/ 20 Free/i)).toBeInTheDocument();
      });

      // Verify NO additional API requests were triggered! (Realtime derivation via useMemo)
      expect(getSpy.mock.calls.length).toBe(initialApiCalls);
    });

    it('displays error state when availability API returns invalid schema', async () => {
      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      });

      vi.spyOn(api, 'get').mockImplementation(async (url: string) => {
        if (url === '/parking-lots') {
          return { data: { success: true, data: mockLots } };
        }
        if (url.includes('/availability/arrival')) {
          // Return malformed data violating schema
          return { data: { success: true, data: { invalidShape: true } } };
        }
        return { data: { success: true, data: null } };
      });

      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <MapPage />
          </MemoryRouter>
        </QueryClientProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('availability-error-alert')).toBeInTheDocument();
      });
      expect(screen.getByTestId('availability-error-alert')).toHaveTextContent(/schema/i);
    });
  });
});
