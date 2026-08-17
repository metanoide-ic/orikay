import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import {
  ArrowLeft,
  Plus,
  MoreVertical,
  Trash2,
  CheckSquare,
  Calendar,
} from 'lucide-react';
import { Button, Badge, Input, Avatar, Select } from '@/components/ui';
import { useData } from '@/lib/dataStore';
import { useAuth } from '@/lib/authStore';
import { useClientMap } from '@/lib/hooks';
import { PRIORITY_META, AUTOMATION_META } from '@/lib/labels';
import { runColumnAutomation } from '@/lib/boardAutomations';
import { cn } from '@/lib/utils';
import type { Card as CardT, ColumnAutomation } from '@/lib/types';
import { CardModal } from '@/components/CardModal';

export default function BoardView() {
  const { boardId = '' } = useParams();
  const board = useData((s) => s.boards.find((b) => b.id === boardId));
  const moveCard = useData((s) => s.moveCard);
  const addColumn = useData((s) => s.addColumn);
  const clientMap = useClientMap();

  const [activeId, setActiveId] = useState<string | null>(null);
  const [openCardId, setOpenCardId] = useState<string | null>(null);
  const [addingCol, setAddingCol] = useState(false);
  const [colName, setColName] = useState('');
  const [colAutomation, setColAutomation] = useState<ColumnAutomation>('nenhuma');

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const activeCard = useMemo(
    () => (activeId && board ? board.cards[activeId] : null),
    [activeId, board],
  );

  if (!board) {
    return (
      <div className="grid place-items-center py-24 text-center">
        <p className="text-white/60">Quadro não encontrado.</p>
        <Link to="/app/quadros" className="mt-3 text-brand-300 hover:text-brand-200">
          Voltar aos quadros
        </Link>
      </div>
    );
  }

  function columnOf(id: string): string | undefined {
    if (!board) return undefined;
    if (board.columns.some((c) => c.id === id)) return id;
    return board.columns.find((c) => c.cardIds.includes(id))?.id;
  }

  function onDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
  }

  function onDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const { active, over } = e;
    if (!over || !board) return;
    const activeCardId = String(active.id);
    const overId = String(over.id);
    const toCol = columnOf(overId);
    if (!toCol) return;

    const fromCol = columnOf(activeCardId);
    const targetCol = board.columns.find((c) => c.id === toCol)!;
    const filtered = targetCol.cardIds.filter((id) => id !== activeCardId);
    let index = filtered.indexOf(overId);
    if (index === -1) index = filtered.length; // soltou na coluna vazia / no fim
    moveCard(board.id, activeCardId, toCol, index);

    // A automação só dispara ao entrar de verdade numa coluna nova — reordenar
    // dentro da mesma coluna não conta, senão mandaria mensagem à toa.
    if (fromCol !== toCol && targetCol.automation && targetCol.automation !== 'nenhuma') {
      void runColumnAutomation(board.id, activeCardId, targetCol.automation);
    }
  }

  const client = board.clientId ? clientMap[board.clientId] : undefined;

  return (
    <div>
      <div className="mb-6">
        <Link
          to="/app/quadros"
          className="inline-flex items-center gap-1.5 text-sm text-white/50 hover:text-white"
        >
          <ArrowLeft size={16} /> Quadros
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold text-white sm:text-3xl">{board.name}</h1>
          {client && <Badge color={client.color}>{client.name}</Badge>}
        </div>
        {board.description && <p className="mt-1 text-sm text-white/50">{board.description}</p>}
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
      >
        <div className="flex gap-4 overflow-x-auto pb-4">
          {board.columns.map((col) => (
            <ColumnView
              key={col.id}
              boardId={board.id}
              col={col}
              cards={col.cardIds.map((id) => board.cards[id]).filter(Boolean)}
              onOpenCard={setOpenCardId}
            />
          ))}

          {/* Adicionar coluna */}
          <div className="w-72 shrink-0">
            {addingCol ? (
              <div className="card p-3">
                <Input
                  value={colName}
                  onChange={(e) => setColName(e.target.value)}
                  placeholder="Nome da coluna"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') setAddingCol(false);
                  }}
                />
                <Select
                  className="mt-2"
                  value={colAutomation}
                  onChange={(e) => setColAutomation(e.target.value as ColumnAutomation)}
                >
                  {(Object.keys(AUTOMATION_META) as ColumnAutomation[]).map((a) => (
                    <option key={a} value={a}>{AUTOMATION_META[a].label}</option>
                  ))}
                </Select>
                {colAutomation !== 'nenhuma' && (
                  <p className="mt-1.5 text-xs text-white/40">{AUTOMATION_META[colAutomation].hint}</p>
                )}
                <div className="mt-2 flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => {
                      if (colName.trim()) addColumn(board.id, colName.trim(), colAutomation === 'nenhuma' ? undefined : colAutomation);
                      setColName('');
                      setColAutomation('nenhuma');
                      setAddingCol(false);
                    }}
                  >
                    Adicionar
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setAddingCol(false)}>
                    Cancelar
                  </Button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setAddingCol(true)}
                className="flex w-full items-center gap-2 rounded-2xl border border-dashed border-line px-4 py-3 text-sm text-white/50 transition hover:border-brand-400/50 hover:text-white"
              >
                <Plus size={16} /> Adicionar coluna
              </button>
            )}
          </div>
        </div>

        <DragOverlay>
          {activeCard ? <CardTile card={activeCard} dragging /> : null}
        </DragOverlay>
      </DndContext>

      {openCardId && (
        <CardModal
          boardId={board.id}
          cardId={openCardId}
          onClose={() => setOpenCardId(null)}
        />
      )}
    </div>
  );
}

/* ------------------------------- Column ------------------------------- */
function ColumnView({
  boardId,
  col,
  cards,
  onOpenCard,
}: {
  boardId: string;
  col: { id: string; title: string; cardIds: string[]; automation?: ColumnAutomation };
  cards: CardT[];
  onOpenCard: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: col.id });
  const addCard = useData((s) => s.addCard);
  const renameColumn = useData((s) => s.renameColumn);
  const removeColumn = useData((s) => s.removeColumn);
  const setColumnAutomation = useData((s) => s.setColumnAutomation);
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState('');
  const [menu, setMenu] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [colTitle, setColTitle] = useState(col.title);
  const automation = col.automation && col.automation !== 'nenhuma' ? col.automation : null;

  return (
    <div className="flex w-72 shrink-0 flex-col">
      <div className="mb-2 flex items-center justify-between px-1">
        {editingTitle ? (
          <input
            value={colTitle}
            onChange={(e) => setColTitle(e.target.value)}
            onBlur={() => {
              renameColumn(boardId, col.id, colTitle.trim() || col.title);
              setEditingTitle(false);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                renameColumn(boardId, col.id, colTitle.trim() || col.title);
                setEditingTitle(false);
              }
            }}
            autoFocus
            className="w-full rounded-md bg-ink-800 px-2 py-1 text-sm font-semibold text-white outline-none"
          />
        ) : (
          <button
            onClick={() => setEditingTitle(true)}
            className="flex items-center gap-2 text-sm font-semibold text-white/85"
            title={automation ? AUTOMATION_META[automation].hint : undefined}
          >
            {col.title}
            <span className="rounded-full bg-white/10 px-2 text-xs text-white/50">{cards.length}</span>
            {automation && (
              <span
                className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                style={{ background: `${AUTOMATION_META[automation].color}22`, color: AUTOMATION_META[automation].color }}
              >
                {AUTOMATION_META[automation].short}
              </span>
            )}
          </button>
        )}
        <div className="relative">
          <button
            onClick={() => setMenu((m) => !m)}
            className="grid h-7 w-7 place-items-center rounded-md text-white/40 hover:bg-white/5 hover:text-white"
          >
            <MoreVertical size={16} />
          </button>
          {menu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenu(false)} />
              <div className="absolute right-0 z-20 mt-1 w-56 rounded-xl border border-line bg-ink-800 p-1 shadow-xl">
                <div className="px-2.5 pb-1 pt-2 text-[11px] font-medium uppercase tracking-wide text-white/35">Automação</div>
                {(Object.keys(AUTOMATION_META) as ColumnAutomation[]).map((a) => (
                  <button
                    key={a}
                    onClick={() => { setColumnAutomation(boardId, col.id, a); setMenu(false); }}
                    className={cn(
                      'flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm hover:bg-white/5',
                      (col.automation ?? 'nenhuma') === a ? 'text-white' : 'text-white/60',
                    )}
                  >
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: AUTOMATION_META[a].color }} />
                    {AUTOMATION_META[a].label}
                  </button>
                ))}
                <div className="my-1 border-t border-line" />
                <button
                  onClick={() => {
                    removeColumn(boardId, col.id);
                    setMenu(false);
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-red-300 hover:bg-red-500/10"
                >
                  <Trash2 size={14} /> Excluir coluna
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <div
        ref={setNodeRef}
        className={cn(
          'flex min-h-[80px] flex-1 flex-col gap-2 rounded-2xl border border-line/60 bg-ink-900/40 p-2 transition',
          isOver && 'border-brand-400/50 bg-brand-500/5',
        )}
      >
        <SortableContext items={col.cardIds} strategy={verticalListSortingStrategy}>
          {cards.map((card) => (
            <SortableCard key={card.id} card={card} onOpen={() => onOpenCard(card.id)} />
          ))}
        </SortableContext>

        {adding ? (
          <div className="rounded-xl border border-line bg-ink-850 p-2">
            <textarea
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Título da tarefa…"
              autoFocus
              rows={2}
              className="w-full resize-none bg-transparent text-sm text-white placeholder:text-white/30 outline-none"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  if (title.trim()) addCard(boardId, col.id, { title: title.trim() });
                  setTitle('');
                }
                if (e.key === 'Escape') setAdding(false);
              }}
            />
            <div className="mt-2 flex gap-2">
              <Button
                size="sm"
                onClick={() => {
                  if (title.trim()) addCard(boardId, col.id, { title: title.trim() });
                  setTitle('');
                }}
              >
                Adicionar
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>
                Fechar
              </Button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setAdding(true)}
            className="flex items-center gap-2 rounded-xl px-2.5 py-2 text-sm text-white/45 transition hover:bg-white/5 hover:text-white"
          >
            <Plus size={15} /> Adicionar tarefa
          </button>
        )}
      </div>
    </div>
  );
}

/* ------------------------------- Card --------------------------------- */
function SortableCard({ card, onOpen }: { card: CardT; onOpen: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: card.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} onClick={onOpen}>
      <CardTile card={card} />
    </div>
  );
}

function CardTile({
  card,
  dragging,
}: {
  card: CardT;
  dragging?: boolean;
}) {
  const clientMap = useClientMap();
  const assignee = useAuth((s) => (card.assigneeId ? s.accounts.find((a) => a.id === card.assigneeId) : undefined));
  const client = card.clientId ? clientMap[card.clientId] : undefined;
  const doneCk = card.checklist.filter((c) => c.done).length;
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div
      className={cn(
        'cursor-pointer touch-none select-none rounded-lg border border-line bg-ink-850 p-3 shadow-sm transition hover:border-white/20',
        dragging && 'rotate-2 border-brand-400/60 shadow-2xl',
      )}
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1 text-left">
          {card.labels.length > 0 && (
            <div className="mb-1.5 flex flex-wrap gap-1">
              {card.labels.map((l) => (
                <span key={l} className="rounded-full bg-brand-500/15 px-2 py-0.5 text-[10px] font-medium text-brand-200">
                  {l}
                </span>
              ))}
            </div>
          )}
          <p className="text-sm leading-snug text-white/90">{card.title}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {card.priority && (
              <span
                className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium"
                style={{
                  background: `${PRIORITY_META[card.priority].color}22`,
                  color: PRIORITY_META[card.priority].color,
                }}
              >
                {PRIORITY_META[card.priority].label}
              </span>
            )}
            {card.dueDate && (
              <span
                className={cn(
                  'inline-flex items-center gap-1 text-[11px]',
                  card.dueDate < today ? 'text-red-300' : 'text-white/45',
                )}
              >
                <Calendar size={12} />
                {new Date(card.dueDate + 'T00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
              </span>
            )}
            {card.checklist.length > 0 && (
              <span className="inline-flex items-center gap-1 text-[11px] text-white/45">
                <CheckSquare size={12} /> {doneCk}/{card.checklist.length}
              </span>
            )}
            {client && (
              <span className="ml-auto inline-flex items-center gap-1 text-[11px] text-white/50">
                <span className="h-2 w-2 rounded-full" style={{ background: client.color }} />
                {client.name}
              </span>
            )}
            {assignee && (
              <span className={cn(client ? '' : 'ml-auto')}>
                <Avatar name={assignee.name} color={assignee.color} size={20} />
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
