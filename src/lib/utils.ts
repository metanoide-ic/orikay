import { clsx, type ClassValue } from 'clsx';

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function uid(prefix = 'id'): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36).slice(-4)}`;
}

/**
 * Nome de cliente sem acento, caixa ou prefixo comum ("Agente Omni X" vira
 * "omni x"), para casar cadastros que variaram de grafia com o tempo.
 */
export function normalizarNome(s: string): string {
  return s
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/^agente\s+/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Acha, numa lista, o item cujo nome bate com `alvo` — exato primeiro, depois por aproximação. */
export function acharPorNome<T>(alvo: string, lista: T[], nomeDe: (item: T) => string): T | undefined {
  const nAlvo = normalizarNome(alvo);
  return (
    lista.find((item) => normalizarNome(nomeDe(item)) === nAlvo) ??
    lista.find((item) => {
      const n = normalizarNome(nomeDe(item));
      return n.length > 3 && nAlvo.length > 3 && (n.includes(nAlvo) || nAlvo.includes(n));
    })
  );
}

/** Hash leve, apenas para não guardar a senha em texto puro no navegador. */
export function hash(str: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16);
}

export const BRL = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

export function money(n: number): string {
  return BRL.format(n || 0);
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export const AVATAR_COLORS = [
  '#7c5cff', '#935cff', '#ec4899', '#f59e0b',
  '#10b981', '#06b6d4', '#3b82f6', '#ef4444',
];

export function pickColor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = seed.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}
