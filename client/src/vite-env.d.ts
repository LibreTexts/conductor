/// <reference types="vite/client" />

interface Window {
  __APP_ENV__: string; // This will be injected at runtime by the server
}
