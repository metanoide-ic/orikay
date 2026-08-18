import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Palette, Database, LogOut, Check, Download, Upload, KeyRound } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { Button, Field, Input, Avatar, Modal } from '@/components/ui';
import { useAuth } from '@/lib/authStore';
import { useData } from '@/lib/dataStore';
import { AVATAR_COLORS, cn } from '@/lib/utils';

/** Chaves persistidas no navegador que compõem um backup completo. */
const BACKUP_KEYS = ['origem.data', 'origem.auth', 'origem.settings'] as const;

export default function Settings() {
  const user = useAuth((s) => s.current());
  const updateProfile = useAuth((s) => s.updateProfile);
  const changePassword = useAuth((s) => s.changePassword);
  const logout = useAuth((s) => s.logout);
  const data = useData();
  const navigate = useNavigate();
  const importRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(user?.name ?? '');
  const [role, setRole] = useState(user?.role ?? '');
  const [color, setColor] = useState(user?.color ?? AVATAR_COLORS[0]);
  const [saved, setSaved] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [backupMsg, setBackupMsg] = useState('');
  const [pwCurrent, setPwCurrent] = useState('');
  const [pwNext, setPwNext] = useState('');
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null);

  if (!user) return null;

  function save() {
    updateProfile({ name: name.trim() || user!.name, role: role.trim(), color });
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  }

  function exportBackup() {
    const payload: Record<string, unknown> = { _tipo: 'backup-plataforma-origem', _versao: 1, _data: new Date().toISOString() };
    for (const k of BACKUP_KEYS) {
      const raw = localStorage.getItem(k);
      if (raw) payload[k] = JSON.parse(raw);
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `origem-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    setBackupMsg('Backup exportado. Guarde o arquivo em local seguro.');
    setTimeout(() => setBackupMsg(''), 5000);
  }

  function importBackup(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        if (parsed?._tipo !== 'backup-plataforma-origem') throw new Error('Arquivo não é um backup da plataforma.');
        for (const k of BACKUP_KEYS) {
          if (parsed[k]) localStorage.setItem(k, JSON.stringify(parsed[k]));
        }
        setBackupMsg('Backup restaurado. Recarregando…');
        setTimeout(() => window.location.reload(), 900);
      } catch (err) {
        setBackupMsg(`Falha ao importar: ${(err as Error).message}`);
        setTimeout(() => setBackupMsg(''), 6000);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  return (
    <div>
      <PageHeader title="Configurações" subtitle="Gerencie seu perfil e os dados da plataforma." />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Perfil */}
          <section className="card p-6">
            <div className="mb-5 flex items-center gap-2 text-white">
              <User size={18} className="text-brand-300" />
              <h3 className="font-semibold">Perfil</h3>
            </div>
            <div className="flex items-center gap-4">
              <Avatar name={name || user.name} color={color} size={64} />
              <div className="text-sm text-white/50">
                Sua inicial e cor aparecem no menu e nas atribuições.
              </div>
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <Field label="Nome">
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </Field>
              <Field label="Cargo">
                <Input value={role} onChange={(e) => setRole(e.target.value)} placeholder="Ex.: Diretor de arte" />
              </Field>
            </div>
            <Field label="Login">
              <Input value={user.login} disabled className="mt-4 opacity-60" />
            </Field>

            <div className="mt-5">
              <div className="mb-2 flex items-center gap-2 text-xs font-medium text-white/60">
                <Palette size={14} /> Cor do avatar
              </div>
              <div className="flex flex-wrap gap-2">
                {AVATAR_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setColor(c)}
                    className={cn('h-8 w-8 rounded-full transition', color === c && 'ring-2 ring-white ring-offset-2 ring-offset-ink-850')}
                    style={{ background: c }}
                  />
                ))}
              </div>
            </div>

            <div className="mt-6 flex items-center gap-3">
              <Button onClick={save}>{saved ? <><Check size={16} /> Salvo</> : 'Salvar alterações'}</Button>
            </div>
          </section>

          {/* Senha */}
          <section className="card p-6">
            <div className="mb-4 flex items-center gap-2 text-white">
              <KeyRound size={18} className="text-brand-300" />
              <h3 className="font-semibold">Alterar senha</h3>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Senha atual">
                <Input type="password" value={pwCurrent} onChange={(e) => setPwCurrent(e.target.value)} autoComplete="current-password" />
              </Field>
              <Field label="Nova senha" hint="Ao menos 6 caracteres.">
                <Input type="password" value={pwNext} onChange={(e) => setPwNext(e.target.value)} autoComplete="new-password" />
              </Field>
            </div>
            {pwMsg && (
              <p className={cn('mt-3 rounded-lg px-3.5 py-2.5 text-sm', pwMsg.ok ? 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-200' : 'border border-red-500/30 bg-red-500/10 text-red-300')}>
                {pwMsg.text}
              </p>
            )}
            <Button className="mt-4" onClick={() => {
              const res = changePassword(pwCurrent, pwNext);
              setPwMsg(res.ok ? { ok: true, text: 'Senha alterada. Use a nova no próximo login.' } : { ok: false, text: res.error || 'Não foi possível alterar.' });
              if (res.ok) { setPwCurrent(''); setPwNext(''); }
              setTimeout(() => setPwMsg(null), 5000);
            }}>Alterar senha</Button>
          </section>

          {/* Dados */}
          <section className="card p-6">
            <div className="mb-4 flex items-center gap-2 text-white">
              <Database size={18} className="text-brand-300" />
              <h3 className="font-semibold">Dados da plataforma</h3>
            </div>
            <p className="text-sm text-white/50">
              Os dados ficam salvos localmente neste navegador/dispositivo. Exporte um
              backup regularmente para não perder nada — e use a importação para
              restaurar ou levar os dados a outro computador.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Button onClick={exportBackup}>
                <Download size={16} /> Exportar backup
              </Button>
              <Button variant="outline" onClick={() => importRef.current?.click()}>
                <Upload size={16} /> Importar backup
              </Button>
              <input ref={importRef} type="file" accept="application/json,.json" hidden onChange={importBackup} />
              <Button variant="outline" onClick={() => {
                const n = data.restoreClients();
                setBackupMsg(n === 0
                  ? 'A carteira já está completa: nenhum cliente faltando.'
                  : `${n} cliente(s) da carteira reposto(s). Nada mais foi alterado.`);
              }}>
                Repor clientes da carteira
              </Button>
              <Button variant="outline" onClick={() => {
                const n = data.restoreBillingFields();
                setBackupMsg(n === 0
                  ? 'Fee, vencimento e forma de pagamento já estavam preenchidos em todo mundo.'
                  : `${n} cliente(s) tiveram fee, vencimento ou forma de pagamento repostos. O que já estava preenchido não foi tocado.`);
              }}>
                Repor fee e forma de pagamento
              </Button>
              <Button variant="outline" onClick={() => {
                const n = data.restoreBriefings();
                setBackupMsg(n === 0
                  ? 'Todo mundo já está com o briefing mais atual (ou com um briefing que a equipe editou na tela, que não é mexido).'
                  : `${n} briefing(s) atualizado(s) com a pesquisa mais recente sobre cada cliente. Briefing que a equipe já tinha editado na tela não foi tocado.`);
              }}>
                Atualizar briefings pesquisados
              </Button>
              <Button variant="danger" onClick={() => setConfirmReset(true)}>
                Limpar todos os dados
              </Button>
            </div>
            {backupMsg && (
              <p className="mt-3 rounded-lg border border-line bg-white/[0.02] px-3.5 py-2.5 text-sm text-white/70">{backupMsg}</p>
            )}
          </section>
        </div>

        {/* Coluna lateral */}
        <div className="space-y-6">
          <section className="card p-6">
            <h3 className="font-semibold text-white">Sessão</h3>
            <p className="mt-1 text-sm text-white/50">
              Conectado como <span className="text-white">{user.login}</span>.
            </p>
            <Button
              variant="outline"
              className="mt-4 w-full"
              onClick={() => {
                logout();
                navigate('/');
              }}
            >
              <LogOut size={16} /> Sair da conta
            </Button>
          </section>

          <section className="card p-6 text-sm text-white/50">
            <h3 className="mb-2 font-semibold text-white">Sobre</h3>
            <p>
              Orikay, a plataforma da Origem: quadros, posts, vídeos e financeiro para a
              rotina da agência.
            </p>
            <p className="mt-3 text-xs text-white/35">Versão 1.0 · Web &amp; App (PWA)</p>
          </section>
        </div>
      </div>

      <Modal
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        title="Limpar todos os dados?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmReset(false)}>Cancelar</Button>
            <Button variant="danger" onClick={() => { data.resetAll(); setConfirmReset(false); }}>
              Sim, limpar tudo
            </Button>
          </>
        }
      >
        <p className="text-sm text-white/60">
          Esta ação remove todos os quadros, posts, lançamentos financeiros e clientes
          deste dispositivo. Sua conta de acesso é mantida. Não é possível desfazer.
        </p>
      </Modal>
    </div>
  );
}
