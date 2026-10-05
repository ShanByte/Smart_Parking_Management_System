import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import {
  ArrivalAvailabilityResponseDataSchema,
  ArrivalAvailabilityResponseData,
} from '@smart-parking/shared';

export interface UseArrivalAvailabilityResult {
  data: ArrivalAvailabilityResponseData | undefined;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => void;
}

/**
 * React Query hook for fetching Arrival Availability for all parking lots.
 * Validates responses against the shared Zod schema.
 * Re-evaluates query key at most once per minute to avoid re-fetching jitter.
 *
 * @param arrivalIsoString UTC ISO string of the target arrival time
 */
export function useArrivalAvailability(arrivalIsoString: string): UseArrivalAvailabilityResult {
  // Round to nearest minute for stable caching and query key
  const arrivalDate = new Date(arrivalIsoString);
  const roundedIso = new Date(
    Math.floor(arrivalDate.getTime() / 60000) * 60000
  ).toISOString();

  const { data, isLoading, isError, error, refetch } = useQuery<ArrivalAvailabilityResponseData>({
    queryKey: ['availability', 'arrival', roundedIso],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: unknown }>('/availability/arrival', {
        params: {
          arrivalTime: arrivalIsoString,
        },
      });

      const parsed = ArrivalAvailabilityResponseDataSchema.safeParse(res.data.data);
      if (!parsed.success) {
        throw new Error(`Invalid availability response schema: ${parsed.error.message}`);
      }

      return parsed.data;
    },
    staleTime: 60 * 1000, // 60 seconds stale time
    refetchInterval: 60 * 1000, // Periodic 1-minute background refresh
  });

  return {
    data,
    isLoading,
    isError,
    error: error as Error | null,
    refetch: () => void refetch(),
  };
}
