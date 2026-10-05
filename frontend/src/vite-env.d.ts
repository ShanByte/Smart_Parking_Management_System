/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
  readonly VITE_SOCKET_URL: string;
  readonly VITE_MAP_TILE_URL?: string;
  readonly VITE_DEMO_PAY_ENABLED?: string;
  readonly VITE_SENTRY_DSN_FRONTEND?: string;
  readonly VITE_USE_MOCKS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
