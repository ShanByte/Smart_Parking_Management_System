// ==============================================================================
// client.ts - Member 4: Simulator HTTP Client
// Security Rule 8: X-Device-Key sent ONLY in header, never logged, timeouts, backoff
// ==============================================================================

export interface ParkingLotSummary {
  id: string;
  name: string;
  totalSlots: number;
}

export interface ParkingSlotSummary {
  id: string;
  slotNumber: string;
  status: string;
}

export class SimulatorApiClient {
  private readonly baseUrl: string;
  private readonly deviceKey: string;
  private readonly timeoutMs: number;

  constructor(baseUrl: string, deviceKey: string, timeoutMs = 5000) {
    // Sanitize baseUrl: strip trailing slashes and any /api/v1 subpath to keep strictly base origin
    this.baseUrl = baseUrl.replace(/\/+$/, '').replace(/\/api\/v1.*$/i, '');
    this.deviceKey = deviceKey;
    this.timeoutMs = timeoutMs;
  }

  /**
   * Fetch active parking lots from GET /api/v1/parking-lots
   */
  async getParkingLots(): Promise<ParkingLotSummary[]> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(`${this.baseUrl}/api/v1/parking-lots`, {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch parking lots: HTTP ${response.status}`);
      }

      const body = (await response.json()) as { success: boolean; data: ParkingLotSummary[] };
      return body.data || [];
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Fetch slots for a given parking lot from GET /api/v1/parking-lots/:id/slots
   */
  async getSlotsByLot(lotId: string): Promise<ParkingSlotSummary[]> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(`${this.baseUrl}/api/v1/parking-lots/${lotId}/slots`, {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch slots for lot ${lotId}: HTTP ${response.status}`);
      }

      const body = (await response.json()) as { success: boolean; data: ParkingSlotSummary[] };
      return body.data || [];
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Sends virtual-sensor event to POST /api/v1/sensors/events.
   * X-Device-Key header is included without ever being logged (Security Rule 8).
   * Implements exponential backoff retry.
   */
  async sendSensorEvent(
    slotId: string,
    status: 'AVAILABLE' | 'OCCUPIED',
    retries = 2,
  ): Promise<boolean> {
    const payload = {
      slotId,
      status,
      timestamp: new Date().toISOString(),
    };

    for (let attempt = 0; attempt <= retries; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);

      try {
        const response = await fetch(`${this.baseUrl}/api/v1/sensors/events`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            // X-Device-Key sent strictly in header, NEVER in query or body (Security Rule 8)
            'X-Device-Key': this.deviceKey,
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });

        if (response.ok) {
          const body = (await response.json()) as { success: boolean; data?: { applied: boolean } };
          return body.data?.applied ?? true;
        }

        if (response.status >= 400 && response.status < 500) {
          // Client errors (e.g. 401 Unauthorized, 404 Not Found) should not retry
          const errBody = (await response.text()).slice(0, 100);
          console.warn(
            `[Simulator] Event rejected for slot ${slotId}: HTTP ${response.status} - ${errBody}`,
          );
          return false;
        }
      } catch (err: unknown) {
        if (attempt === retries) {
          const msg = err instanceof Error ? err.message : String(err);
          console.warn(
            `[Simulator] Network failure sending event for slot ${slotId} (final attempt): ${msg}`,
          );
          return false;
        }
        // Exponential backoff delay before retry
        await new Promise((res) => setTimeout(res, 200 * Math.pow(2, attempt)));
      } finally {
        clearTimeout(timer);
      }
    }

    return false;
  }
}
