import { useMemo } from 'react';
import { useData } from './dataStore';
import type { Client } from './types';

export function useClientMap(): Record<string, Client> {
  const clients = useData((s) => s.clients);
  return useMemo(
    () => Object.fromEntries(clients.map((c) => [c.id, c])),
    [clients],
  );
}

export function monthKey(iso: string): string {
  return iso.slice(0, 7); // YYYY-MM
}

export function isSameMonth(iso: string, ref = new Date()): boolean {
  return iso.slice(0, 7) === ref.toISOString().slice(0, 7);
}
