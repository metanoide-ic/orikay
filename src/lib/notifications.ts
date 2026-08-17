import { useMemo } from 'react';
import { useData } from './dataStore';
import { todayISO } from './utils';
import type { Post } from './types';

export interface Pending {
  post: Post;
  overdue: boolean; // atrasado (data já passou)
}

/** Posts que precisam ser publicados hoje (ou antes) e ainda não foram. */
export function usePendingPosts(): Pending[] {
  const posts = useData((s) => s.posts);
  return useMemo(() => {
    const today = todayISO();
    return posts
      .filter((p) => p.stage !== 'publicado' && !p.published && p.scheduledDate && p.scheduledDate <= today)
      .map((p) => ({ post: p, overdue: (p.scheduledDate as string) < today }))
      .sort((a, b) => (a.post.scheduledDate! < b.post.scheduledDate! ? -1 : 1));
  }, [posts]);
}

const KEY = 'origem.notified';

function notifiedToday(): Set<string> {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '{}');
    if (raw.date === todayISO()) return new Set<string>(raw.ids || []);
  } catch {
    /* ignora */
  }
  return new Set();
}

function markNotified(ids: string[]) {
  localStorage.setItem(KEY, JSON.stringify({ date: todayISO(), ids }));
}

export async function requestNotifyPermission(): Promise<boolean> {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  const res = await Notification.requestPermission();
  return res === 'granted';
}

/** Dispara notificações do navegador para pendências ainda não avisadas hoje. */
export function fireDueNotifications(pending: Pending[]) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const already = notifiedToday();
  const all = new Set(already);
  for (const { post, overdue } of pending) {
    if (already.has(post.id)) continue;
    all.add(post.id);
    new Notification(overdue ? 'Post atrasado' : 'Precisa postar hoje', {
      body: `${post.title} — ${post.platform}`,
      tag: post.id,
      icon: './icon-192.png',
    });
  }
  markNotified([...all]);
}
