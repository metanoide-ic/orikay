import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ClipboardCheck, Plus, Search, Trash2, X, Settings2, History,
} from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { Button, Input, Modal, Field, Badge, Stat, EmptyState, Avatar } from '@/components/ui';
import { useData } from '@/lib/dataStore';
import { useOnboardingTemplate } from '@/lib/onboardingTemplate';
import { ONBOARDING_STATUS_META, type OnboardingStatus } from '@/lib/labels';
import { AVATAR_COLORS, cn } from '@/lib/utils';
import type { Client, OnboardingChecklistItem } from '@/lib/types';

function statusOf(client: Client): OnboardingStatus {
  const items = client.onboardingChecklist ?? [];
  if (items.length === 0) return 'pendente';
  const done = items.filter((i) => i.done).length;
  if (done === 0) return 'pendente';
  if (done === items.length) return 'concluido';
  return 'andamento';
}

function progressOf(client: Client) {
  const items = client.onboardingChecklist ?? [];
  const done = items.filter((i) => i.done).length;
  return { done, total: items.length, pct: items.length ? Math.round((done / items.length) * 100) : 0 };
}

/** Agrupa os itens da checklist por seção, preservando a ordem em que aparecem. */
function bySection(items: OnboardingChecklistItem[]) {
  const order: string[] = [];
  const map = new Map<string, OnboardingChecklistItem[]>();
  for (const it of items) {
    if (!map.has(it.section)) { map.set(it.section, []); order.push(it.section); }
    map.get(it.section)!.push(it);
  }
  return order.map((name) => ({ name, items: map.get(name)! }));
}

export default function ClientChecklist() {
  const {
    clients, addClient, removeClient, events, ensureOnboardingChecklists,
    toggleOnboardingItem, addOnboardingItem, editOnboardingItem, removeOnboardingItem,
  } = useData();
  useEffect(() => { ensureOnboardingChecklists(); }, [ensureOnboardingChecklists]);
  const [selectedId, setSelectedId] = useState<string | null>(clients[0]?.id ?? null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'todos' | OnboardingStatus>('todos');
  const [newOpen, setNewOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [templateOpen, setTemplateOpen] = useState(false);

  const filtered = useMemo(() => {
    return clients.filter((c) => {
      if (filter !== 'todos' && statusOf(c) !== filter) return false;
      if (search && !c.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [clients, search, filter]);

  const selected = clients.find((c) => c.id === selectedId) ?? null;

  const dash = useMemo(() => {
    const pendentes = clients.filter((c) => statusOf(c) === 'pendente').length;
    const andamento = clients.filter((c) => statusOf(c) === 'andamento').length;
    const concluidos = clients.filter((c) => statusOf(c) === 'concluido').length;
    return { total: clients.length, pendentes, andamento, concluidos };
  }, [clients]);

  const atividade = useMemo(
    () => events.filter((e) => e.title.startsWith('Checklist · ')).slice(0, 8),
    [events],
  );

  function criarCliente() {
    if (!newName.trim()) return;
    const color = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
    const client = addClient({ name: newName.trim(), color });
    setSelectedId(client.id);
    setNewName('');
    setNewOpen(false);
  }

  function excluirCliente(c: Client) {
    if (!confirm(`Excluir a checklist de "${c.name}"? O cadastro do cliente não é afetado se ele existir em outras telas — isso remove só o registro daqui.`)) return;
    removeClient(c.id);
    if (selectedId === c.id) setSelectedId(null);
  }

  return (
    <div>
      <PageHeader
        title="Checklist de Clientes"
        subtitle="Onboarding e entrega de cada cliente, do zero ao concluído, em um único lugar."
        action={
          <>
            <Button variant="outline" onClick={() => setTemplateOpen(true)}><Settings2 size={16} className="text-brand-300" /> Modelo padrão</Button>
            <Button onClick={() => setNewOpen(true)}><Plus size={16} /> Novo cliente</Button>
          </>
        }
      />

      {/* Dashboard */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Clientes" value={String(dash.total)} dot="#7c5cff" />
        <Stat label="Não iniciados" value={String(dash.pendentes)} dot={ONBOARDING_STATUS_META.pendente.color} />
        <Stat label="Em andamento" value={String(dash.andamento)} dot={ONBOARDING_STATUS_META.andamento.color} />
        <Stat label="Concluídos" value={String(dash.concluidos)} dot={ONBOARDING_STATUS_META.concluido.color} />
      </div>

      <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
        {/* Roster */}
        <div className="card flex flex-col p-3">
          <div className="mb-2 flex items-center gap-2 rounded-xl border border-line bg-ink-800/70 px-3 py-2">
            <Search size={15} className="text-brand-300/70" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar cliente..."
              className="w-full bg-transparent text-sm text-white placeholder:text-white/30 outline-none"
            />
          </div>
          <div className="mb-2 flex flex-wrap gap-1.5">
            {(['todos', 'pendente', 'andamento', 'concluido'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  'rounded-full px-2.5 py-1 text-xs font-medium transition',
                  filter === f ? 'bg-brand-500/20 text-brand-100' : 'text-white/50 hover:bg-white/5',
                )}
              >
                {f === 'todos' ? 'Todos' : ONBOARDING_STATUS_META[f].label}
              </button>
            ))}
          </div>

          <div className="flex-1 space-y-1 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="px-2 py-8 text-center text-sm text-white/40">Nenhum cliente por aqui.</p>
            ) : (
              filtered.map((c) => {
                const p = progressOf(c);
                const st = statusOf(c);
                return (
                  <button
                    key={c.id}
                    onClick={() => setSelectedId(c.id)}
                    className={cn(
                      'flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2.5 text-left transition',
                      selectedId === c.id ? 'bg-brand-500/15' : 'hover:bg-white/5',
                    )}
                  >
                    <Avatar name={c.name} color={c.color} size={32} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-medium text-white">{c.name}</span>
                        <span className="shrink-0 font-mono text-xs text-white/40">{p.pct}%</span>
                      </div>
                      <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/[0.06]">
                        <div className="h-full rounded-full" style={{ width: `${p.pct}%`, background: ONBOARDING_STATUS_META[st].color }} />
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Detalhe */}
        <div className="space-y-5">
          {!selected ? (
            <EmptyState
              icon={<ClipboardCheck size={40} />}
              title="Nenhum cliente selecionado"
              description="Escolha um cliente na lista ou crie um novo para começar a acompanhar a checklist de onboarding e entrega."
              action={<Button onClick={() => setNewOpen(true)}><Plus size={16} /> Novo cliente</Button>}
            />
          ) : (
            <ClientPanel
              client={selected}
              onToggle={(itemId) => toggleOnboardingItem(selected.id, itemId)}
              onAdd={(section, text) => addOnboardingItem(selected.id, section, text)}
              onEdit={(itemId, text) => editOnboardingItem(selected.id, itemId, text)}
              onRemove={(itemId) => removeOnboardingItem(selected.id, itemId)}
              onDelete={() => excluirCliente(selected)}
            />
          )}

          {/* Atividade recente */}
          <div className="card p-5">
            <div className="mb-3 flex items-center gap-2 text-white"><History size={16} className="text-brand-300" /><h3 className="font-semibold">Atividade recente</h3></div>
            {atividade.length === 0 ? (
              <p className="text-sm text-white/40">Nenhuma marcação ainda — o histórico aparece aqui conforme a equipe usa a checklist.</p>
            ) : (
              <div className="space-y-1.5">
                {atividade.map((e) => (
                  <div key={e.id} className="flex items-center gap-2.5 rounded-lg border border-line bg-white/[0.02] px-3 py-2 text-sm">
                    <span className="min-w-0 flex-1 truncate text-white/80">{e.detail}</span>
                    <span className="shrink-0 text-xs text-white/40">{new Date(e.createdAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Novo cliente */}
      <Modal
        open={newOpen}
        onClose={() => setNewOpen(false)}
        title="Novo cliente"
        footer={<Button onClick={criarCliente}>Criar checklist</Button>}
      >
        <Field label="Nome do cliente">
          <Input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && criarCliente()}
            placeholder="Ex.: Vidroscar"
          />
        </Field>
        <p className="mt-2 text-xs text-white/40">
          A checklist nasce com o modelo padrão — dá para personalizar depois. Um cadastro completo (contato, cadência, cobrança) é feito em <Link to="/app/clientes" className="text-brand-300 hover:text-brand-200">Clientes</Link>.
        </p>
      </Modal>

      {/* Modelo padrão */}
      <TemplateModal open={templateOpen} onClose={() => setTemplateOpen(false)} />
    </div>
  );
}

function ClientPanel({
  client, onToggle, onAdd, onEdit, onRemove, onDelete,
}: {
  client: Client;
  onToggle: (itemId: string) => void;
  onAdd: (section: string, text: string) => void;
  onEdit: (itemId: string, text: string) => void;
  onRemove: (itemId: string) => void;
  onDelete: () => void;
}) {
  const items = client.onboardingChecklist ?? [];
  const p = progressOf(client);
  const st = statusOf(client);
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  return (
    <div>
      <div className="card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <Avatar name={client.name} color={client.color} size={44} />
            <div>
              <h2 className="text-xl font-semibold text-white">{client.name}</h2>
              <div className="mt-1 flex items-center gap-2">
                <Badge color={ONBOARDING_STATUS_META[st].color}>{ONBOARDING_STATUS_META[st].label}</Badge>
                <span className="text-xs text-white/40">Criado em {new Date(client.createdAt).toLocaleDateString('pt-BR')}</span>
              </div>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onDelete} title="Excluir cliente"><Trash2 size={16} className="text-white/50" /></Button>
        </div>
        <div className="mt-4">
          <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
            <div className="h-full rounded-full transition-all" style={{ width: `${p.pct}%`, background: ONBOARDING_STATUS_META[st].color }} />
          </div>
          <div className="mt-1.5 flex justify-between text-xs text-white/40">
            <span>{p.done} de {p.total} itens concluídos</span>
            <span className="font-mono">{p.pct}%</span>
          </div>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {bySection(items).map((sec) => {
          const secDone = sec.items.filter((i) => i.done).length;
          const draft = drafts[sec.name] ?? '';
          return (
            <div key={sec.name} className="card p-4">
              <div className="mb-2.5 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white">{sec.name}</h3>
                <span className="font-mono text-xs text-white/40">{secDone}/{sec.items.length}</span>
              </div>
              <div className="space-y-1">
                {sec.items.map((it) => (
                  <div key={it.id} className="group flex items-start gap-2.5 rounded-lg px-2 py-1.5 hover:bg-white/[0.03]">
                    <input
                      type="checkbox"
                      checked={it.done}
                      onChange={() => onToggle(it.id)}
                      className="mt-1 h-4 w-4 shrink-0 cursor-pointer rounded border-line bg-ink-800 accent-brand-500"
                    />
                    <input
                      value={it.text}
                      onChange={(e) => onEdit(it.id, e.target.value)}
                      className={cn('w-full flex-1 bg-transparent text-sm outline-none', it.done ? 'text-white/40 line-through' : 'text-white/85')}
                    />
                    <button
                      onClick={() => onRemove(it.id)}
                      className="shrink-0 rounded p-1 text-white/25 opacity-0 hover:text-red-300 group-hover:opacity-100"
                      title="Remover item"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
              <div className="mt-2 flex gap-2">
                <input
                  value={draft}
                  onChange={(e) => setDrafts((d) => ({ ...d, [sec.name]: e.target.value }))}
                  onKeyDown={(e) => {
                    if (e.key !== 'Enter' || !draft.trim()) return;
                    onAdd(sec.name, draft);
                    setDrafts((d) => ({ ...d, [sec.name]: '' }));
                  }}
                  placeholder="Adicionar item..."
                  className="w-full flex-1 rounded-lg border border-dashed border-line bg-transparent px-2.5 py-1.5 text-sm text-white placeholder:text-white/30 outline-none"
                />
              </div>
            </div>
          );
        })}
        {items.length === 0 && (
          <EmptyState icon={<ClipboardCheck size={32} />} title="Checklist vazia" description="Adicione seções no modelo padrão ou crie o cliente novamente." />
        )}
      </div>
    </div>
  );
}

function TemplateModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { items, renameItem, removeItem, addItem, addSection } = useOnboardingTemplate();
  const [newSection, setNewSection] = useState('');
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  return (
    <Modal open={open} onClose={onClose} title="Modelo padrão de checklist" wide>
      <p className="mb-4 text-sm text-white/50">
        Aplicado a todo cliente novo. Alterar aqui não muda a checklist de quem já foi cadastrado.
      </p>
      <div className="space-y-4">
        {bySection(items.map((i) => ({ ...i, done: false }))).map((sec) => {
          const draft = drafts[sec.name] ?? '';
          return (
            <div key={sec.name}>
              <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-white/40">{sec.name}</h4>
              <div className="space-y-1.5">
                {sec.items.map((it) => (
                  <div key={it.id} className="flex items-center gap-2">
                    <Input value={it.text} onChange={(e) => renameItem(it.id, e.target.value)} />
                    <Button variant="ghost" size="icon" onClick={() => removeItem(it.id)}><Trash2 size={15} className="text-white/40 hover:text-red-300" /></Button>
                  </div>
                ))}
                <div className="flex items-center gap-2">
                  <Input
                    value={draft}
                    onChange={(e) => setDrafts((d) => ({ ...d, [sec.name]: e.target.value }))}
                    onKeyDown={(e) => {
                      if (e.key !== 'Enter' || !draft.trim()) return;
                      addItem(sec.name, draft);
                      setDrafts((d) => ({ ...d, [sec.name]: '' }));
                    }}
                    placeholder="Novo item nesta seção..."
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-5 flex items-center gap-2 border-t border-line pt-4">
        <Input
          value={newSection}
          onChange={(e) => setNewSection(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== 'Enter' || !newSection.trim()) return;
            addSection(newSection);
            setNewSection('');
          }}
          placeholder="Nome da nova seção..."
        />
        <Button
          variant="outline"
          onClick={() => { if (newSection.trim()) { addSection(newSection); setNewSection(''); } }}
        >
          <Plus size={15} className="text-brand-300" /> Seção
        </Button>
      </div>
    </Modal>
  );
}
