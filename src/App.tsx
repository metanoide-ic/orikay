import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Lock } from 'lucide-react';
import { useAuth } from '@/lib/authStore';
import { AppShell } from '@/components/AppShell';
import { FirstPassword } from '@/components/FirstPassword';
import Landing from '@/pages/Landing';
import Auth from '@/pages/Auth';
import Checklist from '@/pages/Checklist';
import Finance from '@/pages/Finance';
import Posts from '@/pages/Posts';
import Videos from '@/pages/Videos';
import Library from '@/pages/Library';
import Automations from '@/pages/Automations';
import Traffic from '@/pages/Traffic';
import Clients from '@/pages/Clients';
import ClientDetail from '@/pages/ClientDetail';
import ClientChecklist from '@/pages/ClientChecklist';
import Team from '@/pages/Team';
import Integrations from '@/pages/Integrations';
import Settings from '@/pages/Settings';
import { NUVEM } from '@/lib/nuvem/cliente';
import { useSessao } from '@/lib/nuvem/sessao';
import { Carregando, ConvitePagina, Entrar, NovaSenha, SemAgencia } from '@/pages/Acesso';
import EquipeNuvem from '@/pages/EquipeNuvem';

function Protected({ children }: { children: React.ReactNode }) {
  return NUVEM ? <ProtegidoNuvem>{children}</ProtegidoNuvem> : <ProtegidoLocal>{children}</ProtegidoLocal>;
}

/** Na nuvem quem manda é a sessão do Supabase, não o que ficou salvo no navegador. */
function ProtegidoNuvem({ children }: { children: React.ReactNode }) {
  const fase = useSessao((s) => s.fase);
  const location = useLocation();
  if (fase === 'carregando') return <Carregando />;
  if (fase === 'nova-senha') return <NovaSenha />;
  if (fase === 'deslogado') return <Navigate to="/entrar" replace state={{ from: location }} />;
  if (fase === 'sem-agencia') return <SemAgencia />;
  return <AppShell>{children}</AppShell>;
}

function ProtegidoLocal({ children }: { children: React.ReactNode }) {
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

/** /entrar: tela de acesso, ou direto para a plataforma se já estiver dentro. */
function TelaEntrar() {
  const fase = useSessao((s) => s.fase);
  if (!NUVEM) return <Auth />;
  if (fase === 'carregando') return <Carregando />;
  if (fase === 'nova-senha') return <NovaSenha />;
  if (fase === 'deslogado') return <Entrar />;
  return <Navigate to="/app/posts" replace />;
}

export default function App() {
  const location = useLocation();
  const currentLocal = useAuth((s) => s.currentId);
  const fase = useSessao((s) => s.fase);
  const currentId = NUVEM ? (fase === 'pronta' || fase === 'sem-agencia' ? 'nuvem' : null) : currentLocal;

  // Link de "esqueci a senha" volta para a página inicial: abre a tela da senha nova.
  if (NUVEM && fase === 'nova-senha') return <NovaSenha />;

  return (
    <Routes location={location}>
        <Route path="/" element={currentId ? <Navigate to="/app/posts" replace /> : <Landing />} />
        <Route path="/entrar" element={<TelaEntrar />} />
        <Route path="/convite/:token" element={NUVEM ? <ConvitePagina /> : <Navigate to="/entrar" replace />} />

        {/* O quadro de posts é a tela principal da plataforma. */}
        <Route path="/app" element={<Navigate to="/app/posts" replace />} />
        <Route path="/app/checklist" element={<Protected><Checklist /></Protected>} />
        <Route path="/app/posts" element={<Protected><Posts /></Protected>} />
        <Route path="/app/videos" element={<Protected><Videos /></Protected>} />
        <Route path="/app/trafego" element={<Protected><Traffic /></Protected>} />
        <Route path="/app/biblioteca" element={<Protected><Library /></Protected>} />
        <Route path="/app/automacoes" element={<Protected><Automations /></Protected>} />
        <Route path="/app/clientes" element={<Protected><Clients /></Protected>} />
        <Route path="/app/clientes/:clientId" element={<Protected><ClientDetail /></Protected>} />
        <Route path="/app/checklist-clientes" element={<Protected><ClientChecklist /></Protected>} />
        <Route path="/app/equipe" element={<Protected>{NUVEM ? <EquipeNuvem /> : <Team />}</Protected>} />
        <Route path="/app/financeiro" element={<Protected><FinanceGuard /></Protected>} />
        <Route path="/app/integracoes" element={<Protected><Integrations /></Protected>} />
        <Route path="/app/config" element={<Protected><Settings /></Protected>} />

        <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
