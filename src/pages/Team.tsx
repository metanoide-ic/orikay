import { useState } from 'react';
import { UserPlus, Trash2, Wallet, Shield, Users } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { Button, Field, Input, Select, Modal, Avatar, Badge, EmptyState } from '@/components/ui';
import { useAuth } from '@/lib/authStore';

export default function Team() {
  const accounts = useAuth((s) => s.accounts);
  const user = useAuth((s) => s.current());
  const addMember = useAuth((s) => s.addMember);
  const removeMember = useAuth((s) => s.removeMember);
  const setPermission = useAuth((s) => s.setPermission);
  const isAdmin = !!user?.admin;

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', password: '', role: 'Social Media', canFinance: false, admin: false });
  const [error, setError] = useState('');

  function save() {
    setError('');
    const res = addMember(form);
    if (!res.ok) return setError(res.error || 'Erro ao adicionar.');
    setForm({ name: '', password: '', role: 'Social Media', canFinance: false, admin: false });
    setOpen(false);
  }

  return (
    <div>
      <PageHeader
        title="Equipe"
        subtitle="Todos trabalham no mesmo workflow, com quadros, posts, vídeos e financeiro compartilhados."
        action={isAdmin ? <Button onClick={() => setOpen(true)}><UserPlus size={18} /> Adicionar pessoa</Button> : undefined}
      />

      {accounts.length === 0 ? (
        <EmptyState icon={<Users size={40} />} title="Sem membros" description="Adicione pessoas ao workflow da agência." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {accounts.map((a) => (
            <div key={a.id} className="card p-5">
              <div className="flex items-start gap-3">
                <Avatar name={a.name} color={a.color} size={44} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate font-semibold text-white">{a.name}</h3>
                    {a.id === user?.id && <span className="text-xs text-white/40">você</span>}
                  </div>
                  <p className="truncate text-sm text-white/45">{a.role}</p>
                </div>
                {isAdmin && a.id !== user?.id && (
                  <button onClick={() => removeMember(a.id)} className="grid h-8 w-8 place-items-center rounded-lg text-white/40 opacity-0 transition hover:bg-red-500/10 hover:text-red-300 group-hover:opacity-100 [.card:hover_&]:opacity-100">
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {a.admin && <Badge color="#7c5cff"><Shield size={11} /> Admin</Badge>}
                {a.canFinance && <Badge color="#34d399"><Wallet size={11} /> Financeiro</Badge>}
                {!a.admin && !a.canFinance && <Badge>Acesso padrão</Badge>}
              </div>

              {isAdmin && (
                <div className="mt-4 flex flex-wrap gap-3 border-t border-line pt-3 text-xs text-white/60">
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={a.canFinance} onChange={(e) => setPermission(a.id, { canFinance: e.target.checked })} className="h-3.5 w-3.5 accent-[#7c5cff]" />
                    Financeiro
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={a.admin} onChange={(e) => setPermission(a.id, { admin: e.target.checked })} className="h-3.5 w-3.5 accent-[#7c5cff]" />
                    Admin
                  </label>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {!isAdmin && (
        <p className="mt-6 text-sm text-white/40">Somente administradores podem adicionar pessoas ou alterar permissões.</p>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Adicionar pessoa ao workflow"
        footer={<><Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button><Button onClick={save}>Adicionar</Button></>}>
        <div className="space-y-4">
          <Field label="Nome / login"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex.: Marina Costa" autoFocus /></Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Senha inicial"><Input value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="••••••" /></Field>
            <Field label="Cargo">
              <Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                {['Social Media', 'Designer', 'Editor de vídeo', 'Gestor de tráfego', 'Atendimento', 'Direção'].map((r) => <option key={r}>{r}</option>)}
              </Select>
            </Field>
          </div>
          <div className="flex flex-wrap gap-4 rounded-xl border border-line bg-white/[0.02] px-4 py-3 text-sm text-white/70">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={form.canFinance} onChange={(e) => setForm({ ...form, canFinance: e.target.checked })} className="h-4 w-4 accent-[#7c5cff]" /> Pode ver o Financeiro
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={form.admin} onChange={(e) => setForm({ ...form, admin: e.target.checked })} className="h-4 w-4 accent-[#7c5cff]" /> Administrador
            </label>
          </div>
          {error && <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3.5 py-2.5 text-sm text-red-300">{error}</div>}
        </div>
      </Modal>
    </div>
  );
}
