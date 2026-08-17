import { useState } from 'react';
import { KeyRound } from 'lucide-react';
import { Button, Field, Input } from './ui';
import { Logo } from './Logo';
import { useAuth } from '@/lib/authStore';

/**
 * Trava o acesso até a pessoa definir a própria senha.
 *
 * As senhas de fábrica foram combinadas por fora e passaram pelo histórico
 * do projeto. Em vez de contar que cada um lembre de trocar, a plataforma
 * não deixa passar daqui sem trocar.
 */
export function FirstPassword() {
  const user = useAuth((s) => s.current());
  const setInitialPassword = useAuth((s) => s.setInitialPassword);
  const logout = useAuth((s) => s.logout);
  const [senha, setSenha] = useState('');
  const [repetir, setRepetir] = useState('');
  const [erro, setErro] = useState('');

  function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro('');
    if (senha !== repetir) return setErro('As duas senhas não são iguais.');
    const r = setInitialPassword(senha);
    if (!r.ok) setErro(r.error ?? 'Não foi possível salvar.');
  }

  return (
    <div className="grid min-h-screen place-items-center px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center"><Logo /></div>

        <form onSubmit={salvar} className="card p-7">
          <div className="grid h-11 w-11 place-items-center rounded-xl border border-line bg-ink-850 text-white/60">
            <KeyRound size={20} strokeWidth={1.75} />
          </div>
          <h1 className="mt-4 text-xl font-semibold text-white">Defina sua senha</h1>
          <p className="mt-1.5 text-sm text-white/50">
            Olá, {user?.name}. A senha usada para entrar era provisória e vale só para este
            primeiro acesso. Escolha uma que só você saiba.
          </p>

          <div className="mt-6 space-y-4">
            <Field label="Nova senha" hint="No mínimo 6 caracteres.">
              <Input type="password" value={senha} onChange={(e) => setSenha(e.target.value)}
                placeholder="••••••••" autoFocus autoComplete="new-password" />
            </Field>
            <Field label="Repita a nova senha">
              <Input type="password" value={repetir} onChange={(e) => setRepetir(e.target.value)}
                placeholder="••••••••" autoComplete="new-password" />
            </Field>
          </div>

          {erro && <p className="mt-4 text-sm text-red-300">{erro}</p>}

          <Button type="submit" className="mt-6 w-full justify-center">Salvar e entrar</Button>
          <button type="button" onClick={logout}
            className="mt-3 w-full text-center text-xs text-white/40 transition hover:text-white/70">
            Sair e entrar com outra conta
          </button>
        </form>
      </div>
    </div>
  );
}
