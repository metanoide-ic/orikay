import { type ReactNode, useEffect, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  LayoutDashboard, KanbanSquare, Wallet, Users, Settings, LogOut,
  Menu, X, Clapperboard, Library, Zap, Plug, Bell, AlertTriangle, Building2, Columns3, Megaphone,
} from 'lucide-react';
import { Logo, LogoMark } from './Logo';
import { Avatar } from './ui';
import { useAuth } from '@/lib/authStore';
import { useSettings } from '@/lib/settingsStore';
import { usePendingPosts, fireDueNotifications } from '@/lib/notifications';
import { useApprovalInbox } from '@/lib/inbox';
import { autoSendDueCharges } from '@/lib/billing';
import { generateMonthlyExpenses } from '@/lib/expenses';
import { cn } from '@/lib/utils';

interface NavDef { to: string; label: string; icon: typeof LayoutDashboard; end?: boolean; }

function useNav(): NavDef[] {
  const canFinance = useAuth((s) => s.current()?.canFinance);
  const items: NavDef[] = [
    { to: '/app/posts', label: 'Posts', icon: KanbanSquare },
    { to: '/app/quadros', label: 'Quadros', icon: Columns3 },
    { to: '/app/videos', label: 'Vídeos', icon: Clapperboard },
    { to: '/app/painel', label: 'Painel', icon: LayoutDashboard },
    { to: '/app/trafego', label: 'Tráfego', icon: Megaphone },
    { to: '/app/biblioteca', label: 'Biblioteca', icon: Library },
    { to: '/app/automacoes', label: 'Automações', icon: Zap },
    { to: '/app/clientes', label: 'Clientes', icon: Building2 },
    { to: '/app/equipe', label: 'Equipe', icon: Users },
  ];
  if (canFinance) items.push({ to: '/app/financeiro', label: 'Financeiro', icon: Wallet });
  items.push({ to: '/app/integracoes', label: 'Integrações', icon: Plug });
  return items;
}

function NavItems({ onNavigate }: { onNavigate?: () => void }) {
  const nav = useNav();
  return (
    <nav className="space-y-0.5">
      {nav.map(({ to, label, icon: Icon, end }) => (
        <NavLink key={to} to={to} end={end} onClick={onNavigate}
          className={({ isActive }) => cn('group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all',
            isActive ? 'bg-brand-500/15 text-white' : 'text-white/55 hover:text-white hover:bg-white/5')}>
          {({ isActive }) => (
            <>
              {isActive && <motion.span layoutId="nav-active" className="absolute inset-y-1.5 left-0 w-1 rounded-full bg-brand-400" />}
              <Icon size={18} className={isActive ? 'text-brand-300' : ''} />
              {label}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}

function NotificationBell() {
  const pending = usePendingPosts();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const notifyEnabled = useSettings((s) => s.notifyEnabled);

  useEffect(() => {
    if (notifyEnabled) fireDueNotifications(pending);
  }, [pending, notifyEnabled]);

  return (
    <div className="relative">
      <button onClick={() => setOpen((o) => !o)} className="relative grid h-10 w-10 place-items-center rounded-xl text-white/70 hover:bg-white/5" aria-label="Notificações">
        <Bell size={19} />
        {pending.length > 0 && (
          <span className="absolute right-1.5 top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">{pending.length}</span>
        )}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-50 mt-2 w-80 rounded-2xl border border-line bg-ink-850 p-2 shadow-2xl">
            <div className="px-3 py-2 text-sm font-semibold text-white">Precisa postar</div>
            {pending.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-white/40">Tudo em dia por aqui.</p>
            ) : (
              <div className="max-h-80 space-y-1 overflow-y-auto">
                {pending.map(({ post, overdue }) => (
                  <button key={post.id} onClick={() => { setOpen(false); navigate('/app/posts'); }}
                    className="flex w-full items-start gap-2.5 rounded-xl px-3 py-2.5 text-left hover:bg-white/5">
                    <AlertTriangle size={15} className={cn('mt-0.5 shrink-0', overdue ? 'text-red-400' : 'text-amber-400')} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm text-white/90">{post.title}</div>
                      <div className="text-xs text-white/45">{post.platform} · {overdue ? 'atrasado' : 'hoje'}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function UserCard() {
  const user = useAuth((s) => s.current());
  const logout = useAuth((s) => s.logout);
  const navigate = useNavigate();
  if (!user) return null;
  return (
    <div className="rounded-xl border border-line bg-ink-850 p-3">
      <div className="flex items-center gap-3">
        <Avatar name={user.name} color={user.color} size={38} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-white">{user.name}</div>
          <div className="truncate text-xs text-white/45">{user.role}</div>
        </div>
      </div>
      <div className="mt-2 flex gap-1">
        <button onClick={() => navigate('/app/config')} className="flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-white/60 hover:bg-white/5 hover:text-white">
          <Settings size={14} /> Ajustes
        </button>
        <button onClick={() => { logout(); navigate('/'); }} className="flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-white/60 hover:bg-red-500/10 hover:text-red-300">
          <LogOut size={14} /> Sair
        </button>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { pathname } = useLocation();
  const canFinance = useAuth((s) => s.current()?.canFinance);
  useApprovalInbox();

  // Cobrança do dia: roda sozinha ao abrir a plataforma, em qualquer tela,
  // não só quando alguém entra no Financeiro. Só quem tem permissão de
  // financeiro dispara, para não sair cobrando cliente porque o designer
  // abriu o app de manhã.
  useEffect(() => {
    if (!canFinance) return;
    generateMonthlyExpenses();
    void autoSendDueCharges();
  }, [canFinance]);

  return (
    <div className="min-h-screen">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-line bg-ink-900/60 p-4 backdrop-blur-xl lg:flex">
        <div className="flex items-center justify-between px-2 py-2">
          <Logo size="sm" />
          <NotificationBell />
        </div>
        <div className="mt-6 flex-1 overflow-y-auto"><NavItems /></div>
        <UserCard />
      </aside>

      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-ink-900/70 px-4 py-3 backdrop-blur-xl lg:hidden">
        <Logo size="sm" showTagline={false} />
        <div className="flex items-center gap-1">
          <NotificationBell />
          <button onClick={() => setMobileOpen(true)} className="grid h-10 w-10 place-items-center rounded-xl text-white/70 hover:bg-white/5" aria-label="Abrir menu"><Menu size={20} /></button>
        </div>
      </header>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <motion.div initial={{ x: -300 }} animate={{ x: 0 }} className="absolute inset-y-0 left-0 flex w-72 flex-col border-r border-line bg-ink-900 p-4">
            <div className="mb-6 flex items-center justify-between">
              <LogoMark className="h-8 w-8" />
              <button onClick={() => setMobileOpen(false)} className="grid h-9 w-9 place-items-center rounded-xl text-white/70 hover:bg-white/5"><X size={18} /></button>
            </div>
            <div className="flex-1 overflow-y-auto"><NavItems onNavigate={() => setMobileOpen(false)} /></div>
            <UserCard />
          </motion.div>
        </div>
      )}

      <main className="lg:pl-64">
        <motion.div key={pathname} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}
          className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {children}
        </motion.div>
      </main>
    </div>
  );
}
