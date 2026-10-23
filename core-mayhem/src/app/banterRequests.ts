type Side = 'L' | 'R';
interface Request {
  side: Side;
  controller: AbortController;
}
const pending = new Map<Side, Request>();

export function invalidateBanterRequests(): void {
  for (const request of pending.values()) request.controller.abort();
  pending.clear();
}

/** Keep the first request per side; events arriving while it is pending are dropped. */
export function beginBanterRequest(side: Side): Request | null {
  if (pending.has(side)) return null;
  const request = { side, controller: new AbortController() };
  pending.set(side, request);
  return request;
}

export function isCurrentBanterRequest(request: Request): boolean {
  return pending.get(request.side) === request && !request.controller.signal.aborted;
}

export function finishBanterRequest(request: Request): void {
  if (pending.get(request.side) === request) pending.delete(request.side);
}
