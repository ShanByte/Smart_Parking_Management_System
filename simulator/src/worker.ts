// ==============================================================================
// worker.ts - Member 4: Virtual-Sensor Simulator Worker Engine
// Handles simulation ticks, demo mode flips, and graceful process shutdown
// ==============================================================================

import { SimulatorConfig } from './config.js';
import { SimulatorApiClient } from './client.js';
import { SeededRNG, simulateSlotStatus } from './curve.js';

export class SimulatorWorker {
  private readonly config: SimulatorConfig;
  private readonly client: SimulatorApiClient;
  private readonly rng: SeededRNG;
  private timer: NodeJS.Timeout | null = null;
  private isRunning = false;
  private isTickInProgress = false;

  constructor(config: SimulatorConfig) {
    this.config = config;
    this.client = new SimulatorApiClient(config.targetUrl, config.deviceKey);
    this.rng = new SeededRNG(config.seed);
  }

  /**
   * Starts the virtual sensor simulation loop
   */
  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;

    console.log(
      `[Simulator] Started virtual-sensor worker. Target: ${this.config.targetUrl}, Tick: ${this.config.tickSeconds}s, DemoMode: ${this.config.demoMode}`,
    );

    // Initial immediate tick
    void this.tick();

    // Recurring tick interval
    this.timer = setInterval(() => {
      void this.tick();
    }, this.config.tickSeconds * 1000);
  }

  /**
   * Executes a single simulation tick
   */
  async tick(): Promise<void> {
    if (this.isTickInProgress) return;
    this.isTickInProgress = true;

    try {
      const lots = await this.client.getParkingLots();
      if (!lots || lots.length === 0) {
        return;
      }

      for (const lot of lots) {
        if (!this.isRunning) break;

        const slots = await this.client.getSlotsByLot(lot.id);
        if (!slots || slots.length === 0) continue;

        if (this.config.demoMode) {
          // Demo Mode: Pick 1 or 2 slots per lot and toggle their status to demonstrate live socket updates
          const targetSlot = slots[Math.floor(this.rng.next() * slots.length)];
          if (targetSlot) {
            const nextStatus = targetSlot.status === 'AVAILABLE' ? 'OCCUPIED' : 'AVAILABLE';
            await this.client.sendSensorEvent(targetSlot.id, nextStatus);
          }
        } else {
          // Standard Curve Mode: Simulate occupancy per time-of-day probability curve
          const now = new Date();
          for (const slot of slots) {
            if (!this.isRunning) break;
            const desiredStatus = simulateSlotStatus(now, this.rng);
            if (
              slot.status !== desiredStatus &&
              (slot.status === 'AVAILABLE' || slot.status === 'OCCUPIED')
            ) {
              await this.client.sendSensorEvent(slot.id, desiredStatus);
            }
          }
        }
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(`[Simulator] Error in simulation tick: ${message}`);
    } finally {
      this.isTickInProgress = false;
    }
  }

  /**
   * Clean, graceful shutdown stopping timers and in-flight work
   */
  stop(): void {
    if (!this.isRunning) return;
    this.isRunning = false;

    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }

    console.log('[Simulator] Virtual-sensor worker stopped gracefully.');
  }
}
