import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { Button, Field, Input } from '@/components/ui';
import { useAuth } from '@/lib/authStore';
import { useData } from '@/lib/dataStore';

export default function Auth() {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const signup = useAuth((s) => s.signup);
  const login = useAuth((s) => s.login);
  const ensureTeam = useAuth((s) => s.ensureTeam);
  const data = useData();
  const navigate = useNavigate();

  // Garante que as contas oficiais da equipe existam neste dispositivo.
  useEffect(() => {
    ensureTeam();
    if (!data.seeded) data.loadDemo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const res =
      mode === 'signup'
        ? signup({ name, password, role, login: name })
        : login(identifier, password);

    setTimeout(() => {
      setLoading(false);
      if (!res.ok) return setError(res.error || 'Algo deu errado.');
      // Vai direto ao quadro de posts: passar por /app deixaria um redirect
      // pendente que engole o primeiro clique no menu.
      navigate('/app/posts', { replace: true });
    }, 300);
  }

  return (
    <div className="relative grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden overflow-hidden border-r border-line bg-ink-900 lg:block">
        <div className="hairline-grid absolute inset-0 opacity-70" />
        <div className="relative flex h-full flex-col justify-between p-12">
          <Logo />
          <div>
            <div className="mb-5 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.2em] text-white/40">
              <span className="h-px w-8 bg-brand-500/70" /> Orikay, acesso da equipe
            </div>
            <h2 className="font-display text-4xl font-semibold leading-tight text-white">
              A operação da agência,
              <br />
              num só lugar.
            </h2>
            <p className="mt-4 max-w-sm text-white/55">
              Quadros, posts, vídeos, financeiro e automações. Entre com sua conta e
              continue de onde parou.
            </p>
          </div>
          <p className="text-xs tracking-wide text-white/35">Orikay · Origem Comunicação &amp; Marketing</p>
        </div>
      </div>

      <div className="relative flex items-center justify-center p-6">
        <Link to="/" className="absolute left-5 top-5 inline-flex items-center gap-1.5 text-sm text-white/50 hover:text-white">
          <ArrowLeft size={16} /> Voltar
        </Link>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm">
          <div className="mb-8 lg:hidden"><Logo /></div>

          <h1 className="text-2xl font-semibold text-white">
            {mode === 'signup' ? 'Criar conta' : 'Entrar'}
          </h1>
          <p className="mt-1.5 text-sm text-white/50">
            {mode === 'signup' ? 'Leva menos de um minuto.' : 'Use seu login e senha da equipe.'}
          </p>

          <form onSubmit={submit} className="mt-7 space-y-4">
            {mode === 'signup' ? (
              <>
                <Field label="Nome / login">
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Ana Ribeiro" autoFocus />
                </Field>
                <Field label="Cargo (opcional)">
                  <Input value={role} onChange={(e) => setRole(e.target.value)} placeholder="Ex.: Social Media" />
                </Field>
              </>
            ) : (
              <Field label="Login">
                <Input value={identifier} onChange={(e) => setIdentifier(e.target.value)} placeholder="Ex.: João Paulo" autoFocus autoComplete="username" />
              </Field>
            )}
            <Field label="Senha">
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} />
            </Field>

            {error && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3.5 py-2.5 text-sm text-red-300">{error}</div>
            )}

            <Button type="submit" size="lg" className="w-full" disabled={loading}>
              {loading && <Loader2 size={18} className="animate-spin" />}
              {mode === 'signup' ? 'Criar conta e entrar' : 'Entrar'}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-white/50">
            {mode === 'signup' ? (
              <>Já tem conta?{' '}
                <button onClick={() => { setMode('login'); setError(''); }} className="font-medium text-brand-300 hover:text-brand-200">Entrar</button>
              </>
            ) : (
              <>Novo por aqui?{' '}
                <button onClick={() => { setMode('signup'); setError(''); }} className="font-medium text-brand-300 hover:text-brand-200">Criar conta</button>
              </>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
