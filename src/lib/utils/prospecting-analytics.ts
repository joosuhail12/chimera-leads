'use client';

export async function logProspectingEvent(
  event: string,
  payload?: Record<string, any>
): Promise<void> {
  try {
    const body = JSON.stringify({ event, payload });

    if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
      const blob = new Blob([body], { type: 'application/json' });
      navigator.sendBeacon('/api/analytics/prospecting', blob);
      return;
    }

    await fetch('/api/analytics/prospecting', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    });
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('Failed to log prospecting event', error);
    }
  }
}
