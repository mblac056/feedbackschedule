/// <reference types="vite/client" />

interface WakeLockSentinel extends EventTarget {
  readonly released: boolean;
  readonly type: 'screen';
  release(): Promise<void>;
}

interface WakeLock {
  request(type: 'screen'): Promise<WakeLockSentinel>;
}

interface WindowEventMap {
  'entrantsUpdated': CustomEvent;
  'evalmatrix:persist-failed': CustomEvent<{ operation: string; quotaExceeded: boolean }>;
  'evalmatrix:persist-ok': CustomEvent<{ operation: string }>;
  'evalmatrix:flush-persist': Event;
}

interface Navigator {
  readonly wakeLock?: WakeLock;
}
