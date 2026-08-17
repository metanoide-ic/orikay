import { useState } from 'react';
import { Link } from 'react-router-dom';
import { KanbanSquare, Plus, Layers } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { Button, Field, Input, Modal, Select, Badge, EmptyState } from '@/components/ui';
import { useData } from '@/lib/dataStore';
import { useClientMap } from '@/lib/hooks';
import { BOARD_AREA_META } from '@/lib/labels';
import type { Board, BoardArea } from '@/lib/types';

const AREAS: BoardArea[] = ['designer', 'filmmaker', 'trafego', 'outro'];

export default function Boards() {
  const { boards, clients, addBoard } = useData();
  const clientMap = useClientMap();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [clientId, setClientId] = useState('');
  const [area, setArea] = useState<BoardArea>('designer');

  function create() {
    if (!name.trim()) return;
    addBoard({ name: name.trim(), clientId: clientId || undefined, area });
    setName('');
    setClientId('');
    setOpen(false);
  }

  const grupos: Array<{ area: BoardArea; itens: Board[] }> = AREAS
    .map((a) => ({ area: a, itens: boards.filter((b) => (b.area ?? 'outro') === a) }))
    .filter((g) => g.itens.length > 0);

  return (
    <div>
      <PageHeader
        title="Quadros"
        subtitle="Organize as demandas da agência em fluxos visuais."
        action={
          <Button onClick={() => setOpen(true)}>
            <Plus size={18} /> Novo quadro
          </Button>
        }
      />

      {boards.length === 0 ? (
        <EmptyState
          icon={<KanbanSquare size={40} />}
          title="Nenhum quadro ainda"
          description="Crie seu primeiro quadro para acompanhar tarefas de ponta a ponta."
          action={
            <Button onClick={() => setOpen(true)}>
              <Plus size={18} /> Criar quadro
            </Button>
          }
        />
      ) : (
        <div className="space-y-8">
          {grupos.map(({ area: a, itens }) => (
            <div key={a}>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-white/40">{BOARD_AREA_META[a].label}</h2>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {itens.map((b) => {
                  const total = Object.keys(b.cards).length;
                  const doneCol = b.columns[b.columns.length - 1];
                  const done = doneCol ? doneCol.cardIds.length : 0;
                  const pct = total ? Math.round((done / total) * 100) : 0;
                  const client = b.clientId ? clientMap[b.clientId] : undefined;
                  return (
                    <Link
                      key={b.id}
                      to={`/app/quadros/${b.id}`}
                      className="card group relative overflow-hidden p-5 transition hover:border-brand-400/50"
                    >
                      <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-brand-500/10 blur-2xl transition group-hover:bg-brand-500/20" />
                      <div className="relative flex items-start justify-between">
                        <div className="grid h-11 w-11 place-items-center rounded-xl bg-brand-500/15 text-brand-300">
                          <Layers size={20} />
                        </div>
                        {client && <Badge color={client.color}>{client.name}</Badge>}
                      </div>
                      <h3 className="relative mt-4 text-lg font-semibold text-white">{b.name}</h3>
                      <div className="relative mt-1 text-sm text-white/45">
                        {b.columns.length} colunas · {total} tarefas
                      </div>
                      <div className="relative mt-4">
                        <div className="mb-1 flex justify-between text-xs text-white/45">
                          <span>Progresso</span>
                          <span>{pct}%</span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                          <div className="h-full rounded-full bg-gradient-to-r from-brand-500 to-brand-300" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Novo quadro"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={create}>Criar quadro</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Nome do quadro">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Produção de Conteúdo" autoFocus />
          </Field>
          <Field label="Área">
            <Select value={area} onChange={(e) => setArea(e.target.value as BoardArea)}>
              {AREAS.map((a) => (
                <option key={a} value={a}>{BOARD_AREA_META[a].label}</option>
              ))}
            </Select>
          </Field>
          <Field label="Cliente (opcional)">
            <Select value={clientId} onChange={(e) => setClientId(e.target.value)}>
              <option value="">Sem cliente</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
          </Field>
          <p className="text-xs text-white/40">
            O quadro já vem com as colunas <b>A fazer</b>, <b>Em produção</b>, <b>Revisão</b>, <b>Prontos</b> e <b>Concluído</b>. Você pode editar depois — inclusive marcar colunas com Envio Automático, Alteração Automática ou Post Automático (menu "⋮" da coluna).
          </p>
        </div>
      </Modal>
    </div>
  );
}
