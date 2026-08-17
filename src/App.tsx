import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Lock } from 'lucide-react';
import { useAuth } from '@/lib/authStore';
import { AppShell } from '@/components/AppShell';
import { FirstPassword } from '@/components/FirstPassword';
import Landing from '@/pages/Landing';
import Auth from '@/pages/Auth';
import Dashboard from '@/pages/Dashboard';
import Checklist from '@/pages/Checklist';
import Boards from '@/pages/Boards';
import BoardView from '@/pages/BoardView';
import Finance from '@/pages/Finance';
import Posts from '@/pages/Posts';
import Videos from '@/pages/Videos';
import Library from '@/pages/Library';
import Automations from '@/pages/Automations';
import Traffic from '@/pages/Traffic';
import Clients from '@/pages/Clients';
import ClientDetail from '@/pages/ClientDetail';
import Team from '@/pages/Team';
import Integrations from '@/pages/Integrations';
import Settings from '@/pages/Settings';

function Protected({ children }: { children: React.ReactNode }) {
  const currentId = useAuth((s) => s.currentId);
  const precisaTrocar = useAuth((s) => s.current()?.mustChangePassword);
  const location = useLocation();
  if (!currentId) return <Navigate to="/entrar" replace state={{ from: location }} />;
  // Senha provisória não abre nenhuma tela: troca primeiro.
  if (precisaTrocar) return <FirstPassword />;
  return <AppShell>{children}</AppShell>;
}

function FinanceGuard() {
  const canFinance = useAuth((s) => s.current()?.canFinance);
  return canFinance ? <Finance /> : <NoAccess />;
}

function NoAccess() {
  return (
    <div className="grid place-items-center py-24 text-center">
      <div className="grid h-14 w-14 place-items-center rounded-xl border border-line bg-ink-850 text-white/50">
        <Lock size={24} strokeWidth={1.75} />
      </div>
      <h2 className="mt-5 text-xl font-semibold text-white">Acesso restrito</h2>
      <p className="mt-1 max-w-sm text-sm text-white/50">
        O Financeiro é visível apenas para contas com permissão especial. Peça a um
        administrador para liberar em Integrações → Permissões.
      </p>
    </div>
  );
}

export default function App() {
  const location = useLocation();
  const currentId = useAuth((s) => s.currentId);

  return (
    <Routes location={location}>
        <Route path="/" element={currentId ? <Navigate to="/app/posts" replace /> : <Landing />} />
        <Route path="/entrar" element={currentId ? <Navigate to="/app/posts" replace /> : <Auth />} />

        {/* O quadro de posts é a tela principal da plataforma. */}
        <Route path="/app" element={<Navigate to="/app/posts" replace />} />
        <Route path="/app/painel" element={<Protected><Dashboard /></Protected>} />
        <Route path="/app/checklist" element={<Protected><Checklist /></Protected>} />
        <Route path="/app/quadros" element={<Protected><Boards /></Protected>} />
        <Route path="/app/quadros/:boardId" element={<Protected><BoardView /></Protected>} />
        <Route path="/app/posts" element={<Protected><Posts /></Protected>} />
        <Route path="/app/videos" element={<Protected><Videos /></Protected>} />
        <Route path="/app/trafego" element={<Protected><Traffic /></Protected>} />
        <Route path="/app/biblioteca" element={<Protected><Library /></Protected>} />
        <Route path="/app/automacoes" element={<Protected><Automations /></Protected>} />
        <Route path="/app/clientes" element={<Protected><Clients /></Protected>} />
        <Route path="/app/clientes/:clientId" element={<Protected><ClientDetail /></Protected>} />
        <Route path="/app/equipe" element={<Protected><Team /></Protected>} />
        <Route path="/app/financeiro" element={<Protected><FinanceGuard /></Protected>} />
        <Route path="/app/integracoes" element={<Protected><Integrations /></Protected>} />
        <Route path="/app/config" element={<Protected><Settings /></Protected>} />

        <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
