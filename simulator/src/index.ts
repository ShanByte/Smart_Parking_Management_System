// ==============================================================================
// index.ts - Member 4: Virtual Sensor Simulator Main Entry Point
// ==============================================================================

import { loadConfig } from './config.js';
import { SimulatorWorker } from './worker.js';

function main(): void {
  try {
    const config = loadConfig(process.env);
    const worker = new SimulatorWorker(config);

    // Graceful process shutdown handling
    const shutdown = (signal: string) => {
      console.log(`[Simulator] Received ${signal}. Initiating graceful shutdown...`);
      worker.stop();
      process.exit(0);
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));

    worker.start();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[Simulator FATAL] Failed to initialize simulator: ${message}`);
    process.exit(1);
  }
}

main();
