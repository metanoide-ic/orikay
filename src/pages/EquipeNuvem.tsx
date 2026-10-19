import { useEffect, useState } from 'react';
import { Check, Copy, Link2, Loader2, Shield, Trash2, UserPlus, Users, Wallet, X } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { Avatar, Badge, Button, EmptyState, Field, Input, Modal, Select } from '@/components/ui';
import {
  cancelarConvite, criarConvite, definirPermissoes, linkDoConvite, listarConvites, removerMembro,
  renomearAgencia, useSessao, type Convite,
} from '@/lib/nuvem/sessao';

const CARGOS = ['Social Media', 'Designer', 'Editor de vídeo', 'Filmmaker', 'Gestor de tráfego', 'Atendimento', 'Direção'];

/** Equipe da agência na nuvem: membros de verdade e convite por link. */
export default function EquipeNuvem() {
  const membros = useSessao((s) => s.membros);
  const user = useSessao((s) => s.user);
  const agencia = useSessao((s) => s.agencias.find((a) => a.id === s.agenciaId));
  const eu = membros.find((m) => m.user_id === user?.id);
  const isAdmin = !!eu?.admin;

  const [convites, setConvites] = useState<Convite[]>([]);
  const [aberto, setAberto] = useState(false);
  const [form, setForm] = useState({ cargo: 'Social Media', financeiro: false, admin: false });
  const [link, setLink] = useState('');
  const [copiado, setCopiado] = useState('');
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [confirmarSaida, setConfirmarSaida] = useState<string | null>(null);
  const [nomeAgencia, setNomeAgencia] = useState(agencia?.nome ?? '');

  useEffect(() => { if (isAdmin) void listarConvites().then(setConvites); }, [isAdmin, link]);
  useEffect(() => { setNomeAgencia(agencia?.nome ?? ''); }, [agencia?.nome]);

  async function gerar() {
    setErro(''); setOcupado('gerar');
    const r = await criarConvite(form);
    setOcupado(null);
    if (!r.ok) return setErro(r.erro);
    setLink(r.link);
  }

  async function copiar(texto: string) {
    try { await navigator.clipboard.writeText(texto); } catch { /* sem permissão: o campo fica selecionável */ }
    setCopiado(texto);
    setTimeout(() => setCopiado(''), 1800);
  }

  async function permissao(userId: string, p: { admin: boolean; financeiro: boolean }) {
    setErro(''); setOcupado(userId);
    const r = await definirPermissoes(userId, p);
    setOcupado(null);
    if (!r.ok) setErro(r.erro);
  }

  async function remover(userId: string) {
    setErro(''); setOcupado(userId);
    const r = await removerMembro(userId);
    setOcupado(null);
    setConfirmarSaida(null);
    if (!r.ok) setErro(r.erro);
  }

  const mensagem = (l: string) =>
    `Oi! Te adicionei na ${agencia?.nome ?? 'nossa agência'} no Orikay. Entra por este link e cria sua senha: ${l}`;

  return (
    <div>
      <PageHeader
        title="Equipe"
        subtitle={`Quem trabalha na ${agencia?.nome ?? 'agência'}. Todo mundo vê os mesmos posts, vídeos e clientes, em qualquer aparelho.`}
        action={isAdmin ? <Button onClick={() => { setLink(''); setErro(''); setAberto(true); }}><UserPlus size={18} /> Convidar pessoa</Button> : undefined}
      />

      {erro && !aberto && <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-3.5 py-2.5 text-sm text-red-300">{erro}</div>}

      {membros.length === 0 ? (
        <EmptyState icon={<Users size={40} />} title="Sem membros" description="Convide a equipe da agência." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {membros.map((m) => (
            <div key={m.user_id} className="card p-5">
              <div className="flex items-start gap-3">
                <Avatar name={m.nome} color={m.cor} size={44} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate font-semibold text-white">{m.nome}</h3>
                    {m.user_id === user?.id && <span className="text-xs text-white/40">você</span>}
                  </div>
                  <p className="truncate text-sm text-white/45">{m.cargo}</p>
                  {m.email && <p className="truncate text-xs text-white/35">{m.email}</p>}
                </div>
                {ocupado === m.user_id && <Loader2 size={16} className="animate-spin text-white/40" />}
                {isAdmin && m.user_id !== user?.id && ocupado !== m.user_id && (
                  <button onClick={() => setConfirmarSaida(m.user_id)} aria-label={`Remover ${m.nome}`}
                    className="grid h-8 w-8 place-items-center rounded-lg text-white/40 transition hover:bg-red-500/10 hover:text-red-300">
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {m.admin && <Badge color="#7c5cff"><Shield size={11} /> Admin</Badge>}
                {(m.financeiro || m.admin) && <Badge color="#34d399"><Wallet size={11} /> Financeiro</Badge>}
                {!m.admin && !m.financeiro && <Badge>Acesso padrão</Badge>}
              </div>
              {isAdmin && (
                <div className="mt-4 flex flex-wrap gap-3 border-t border-line pt-3 text-xs text-white/60">
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={m.financeiro || m.admin} disabled={m.admin || ocupado === m.user_id}
                      onChange={(e) => void permissao(m.user_id, { admin: m.admin, financeiro: e.target.checked })} className="h-3.5 w-3.5 accent-[#7c5cff]" />
                    Financeiro
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={m.admin} disabled={ocupado === m.user_id}
                      onChange={(e) => void permissao(m.user_id, { admin: e.target.checked, financeiro: m.financeiro })} className="h-3.5 w-3.5 accent-[#7c5cff]" />
                    Admin
                  </label>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {isAdmin && convites.length > 0 && (
        <section className="mt-8">
          <h3 className="mb-3 text-sm font-semibold text-white/80">Convites esperando alguém entrar</h3>
          <div className="space-y-2">
            {convites.map((c) => (
              <div key={c.token} className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-ink-850 px-4 py-3 text-sm">
                <Link2 size={15} className="text-white/40" />
                <span className="text-white/80">{c.cargo}</span>
                {c.admin && <Badge color="#7c5cff">Admin</Badge>}
                {c.financeiro && <Badge color="#34d399">Financeiro</Badge>}
                <span className="text-xs text-white/35">vale até {new Date(c.expira_em).toLocaleDateString('pt-BR')}</span>
                <div className="ml-auto flex gap-1">
                  <Button size="sm" variant="outline" onClick={() => void copiar(mensagem(linkDoConvite(c.token)))}>
                    {copiado === mensagem(linkDoConvite(c.token)) ? <Check size={14} /> : <Copy size={14} />} Copiar
                  </Button>
                  <button onClick={() => void cancelarConvite(c.token).then(() => listarConvites().then(setConvites))}
                    className="grid h-8 w-8 place-items-center rounded-lg text-white/40 hover:bg-red-500/10 hover:text-red-300" aria-label="Cancelar convite">
                    <X size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {isAdmin && (
        <section className="card mt-8 max-w-xl p-6">
          <h3 className="font-semibold text-white">Nome da agência</h3>
          <p className="mt-1 text-sm text-white/50">Aparece no menu, nas mensagens de cobrança e no PDF do planejamento.</p>
          <div className="mt-4 flex gap-2">
            <Input value={nomeAgencia} onChange={(e) => setNomeAgencia(e.target.value)} />
            <Button variant="outline" disabled={!nomeAgencia.trim() || nomeAgencia.trim() === agencia?.nome}
              onClick={() => void renomearAgencia(nomeAgencia).then((r) => { if (!r.ok) setErro(r.erro); })}>Salvar</Button>
          </div>
        </section>
      )}

      {!isAdmin && (
        <p className="mt-6 text-sm text-white/40">Só administradores convidam pessoas e mudam permissões.</p>
      )}

      <Modal open={aberto} onClose={() => setAberto(false)} title="Convidar pessoa para a equipe"
        footer={link
          ? <Button onClick={() => setAberto(false)}>Pronto</Button>
          : <><Button variant="ghost" onClick={() => setAberto(false)}>Cancelar</Button>
            <Button onClick={() => void gerar()} disabled={ocupado === 'gerar'}>
              {ocupado === 'gerar' && <Loader2 size={16} className="animate-spin" />} Gerar link de convite
            </Button></>}>
        {!link ? (
          <div className="space-y-4">
            <Field label="Cargo">
              <Select value={form.cargo} onChange={(e) => setForm({ ...form, cargo: e.target.value })}>
                {CARGOS.map((r) => <option key={r}>{r}</option>)}
              </Select>
            </Field>
            <div className="flex flex-wrap gap-4 rounded-xl border border-line bg-white/[0.02] px-4 py-3 text-sm text-white/70">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={form.financeiro} onChange={(e) => setForm({ ...form, financeiro: e.target.checked })} className="h-4 w-4 accent-[#7c5cff]" /> Pode ver o Financeiro
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={form.admin} onChange={(e) => setForm({ ...form, admin: e.target.checked })} className="h-4 w-4 accent-[#7c5cff]" /> Administrador
              </label>
            </div>
            <p className="text-xs text-white/40">O link vale para uma pessoa e expira em 14 dias. Quem abrir cria a própria senha.</p>
            {erro && <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3.5 py-2.5 text-sm text-red-300">{erro}</div>}
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-white/60">Mande esta mensagem para a pessoa (WhatsApp, e-mail…):</p>
            <textarea readOnly value={mensagem(link)} onFocus={(e) => e.target.select()}
              className="min-h-[96px] w-full rounded-xl border border-line bg-ink-900 px-3.5 py-3 text-sm text-white/80" />
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => void copiar(mensagem(link))}>
                {copiado === mensagem(link) ? <><Check size={16} /> Copiado</> : <><Copy size={16} /> Copiar mensagem</>}
              </Button>
              <a href={`https://wa.me/?text=${encodeURIComponent(mensagem(link))}`} target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-xl border border-line px-4 py-2 text-sm font-medium text-white/80 hover:bg-white/5">
                Abrir no WhatsApp
              </a>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={!!confirmarSaida} onClose={() => setConfirmarSaida(null)} title="Tirar esta pessoa da equipe?"
        footer={<><Button variant="ghost" onClick={() => setConfirmarSaida(null)}>Cancelar</Button>
          <Button variant="danger" onClick={() => confirmarSaida && void remover(confirmarSaida)}>Tirar da equipe</Button></>}>
        <p className="text-sm text-white/60">
          {membros.find((m) => m.user_id === confirmarSaida)?.nome} perde o acesso à agência na hora. Posts e vídeos
          dela continuam na plataforma. Dá para convidar de novo depois.
        </p>
      </Modal>
    </div>
  );
}
