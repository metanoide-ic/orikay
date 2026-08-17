import { useState } from 'react';
import { Plus, Trash2, X, Check } from 'lucide-react';
import { Modal, Button, Field, Input, Textarea, Select } from './ui';
import { useData } from '@/lib/dataStore';
import { useAuth } from '@/lib/authStore';
import { PRIORITY_META, LABEL_PALETTE } from '@/lib/labels';
import { uid, cn } from '@/lib/utils';
import type { Priority } from '@/lib/types';

export function CardModal({
  boardId,
  cardId,
  onClose,
}: {
  boardId: string;
  cardId: string;
  onClose: () => void;
}) {
  const board = useData((s) => s.boards.find((b) => b.id === boardId));
  const clients = useData((s) => s.clients);
  const members = useAuth((s) => s.accounts);
  const updateCard = useData((s) => s.updateCard);
  const removeCard = useData((s) => s.removeCard);
  const [newCk, setNewCk] = useState('');

  const card = board?.cards[cardId];
  if (!board || !card) return null;

  const colId = board.columns.find((c) => c.cardIds.includes(cardId))?.id;
  const doneCount = card.checklist.filter((c) => c.done).length;
  const pct = card.checklist.length ? Math.round((doneCount / card.checklist.length) * 100) : 0;

  const toggleLabel = (label: string) => {
    const has = card.labels.includes(label);
    updateCard(boardId, cardId, {
      labels: has ? card.labels.filter((l) => l !== label) : [...card.labels, label],
    });
  };

  return (
    <Modal open onClose={onClose} wide title="Detalhes da tarefa">
      <div className="space-y-5">
        <Field label="Título">
          <Input
            value={card.title}
            onChange={(e) => updateCard(boardId, cardId, { title: e.target.value })}
          />
        </Field>

        <Field label="Descrição">
          <Textarea
            value={card.description ?? ''}
            onChange={(e) => updateCard(boardId, cardId, { description: e.target.value })}
            placeholder="Detalhe o briefing, links, referências…"
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Prioridade">
            <Select
              value={card.priority ?? ''}
              onChange={(e) =>
                updateCard(boardId, cardId, {
                  priority: (e.target.value || undefined) as Priority | undefined,
                })
              }
            >
              <option value="">—</option>
              {(Object.keys(PRIORITY_META) as Priority[]).map((p) => (
                <option key={p} value={p}>{PRIORITY_META[p].label}</option>
              ))}
            </Select>
          </Field>
          <Field label="Prazo">
            <Input
              type="date"
              value={card.dueDate ?? ''}
              onChange={(e) => updateCard(boardId, cardId, { dueDate: e.target.value || undefined })}
            />
          </Field>
          <Field label="Cliente">
            <Select
              value={card.clientId ?? ''}
              onChange={(e) => updateCard(boardId, cardId, { clientId: e.target.value || undefined })}
            >
              <option value="">—</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
          </Field>
        </div>

        <Field label="Responsável">
          <Select
            value={card.assigneeId ?? ''}
            onChange={(e) => updateCard(boardId, cardId, { assigneeId: e.target.value || undefined })}
          >
            <option value="">Ninguém atribuído</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>{m.name} · {m.role}</option>
            ))}
          </Select>
        </Field>

        {/* Etiquetas */}
        <div>
          <div className="mb-1.5 text-xs font-medium text-white/60">Etiquetas</div>
          <div className="flex flex-wrap gap-1.5">
            {LABEL_PALETTE.map((l) => {
              const active = card.labels.includes(l);
              return (
                <button
                  key={l}
                  onClick={() => toggleLabel(l)}
                  className={cn(
                    'rounded-full px-2.5 py-1 text-xs font-medium transition',
                    active
                      ? 'bg-brand-500/25 text-brand-100 ring-1 ring-brand-400/50'
                      : 'bg-white/5 text-white/50 hover:bg-white/10',
                  )}
                >
                  {l}
                </button>
              );
            })}
          </div>
        </div>

        {/* Checklist */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <div className="text-xs font-medium text-white/60">
              Checklist {card.checklist.length > 0 && `· ${doneCount}/${card.checklist.length}`}
            </div>
            {card.checklist.length > 0 && (
              <div className="flex items-center gap-2">
                <div className="h-1.5 w-24 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full bg-brand-400" style={{ width: `${pct}%` }} />
                </div>
                <span className="text-xs text-white/40">{pct}%</span>
              </div>
            )}
          </div>
          <div className="space-y-1.5">
            {card.checklist.map((item) => (
              <div key={item.id} className="group flex items-center gap-2.5 rounded-lg px-1 py-1">
                <button
                  onClick={() =>
                    updateCard(boardId, cardId, {
                      checklist: card.checklist.map((c) =>
                        c.id === item.id ? { ...c, done: !c.done } : c,
                      ),
                    })
                  }
                  className={cn(
                    'grid h-5 w-5 shrink-0 place-items-center rounded-md border transition',
                    item.done ? 'border-brand-400 bg-brand-500 text-white' : 'border-line text-transparent hover:border-brand-400',
                  )}
                >
                  <Check size={13} />
                </button>
                <span className={cn('flex-1 text-sm', item.done ? 'text-white/40 line-through' : 'text-white/85')}>
                  {item.text}
                </span>
                <button
                  onClick={() =>
                    updateCard(boardId, cardId, {
                      checklist: card.checklist.filter((c) => c.id !== item.id),
                    })
                  }
                  className="text-white/20 opacity-0 transition hover:text-red-300 group-hover:opacity-100"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
          <div className="mt-2 flex gap-2">
            <Input
              value={newCk}
              onChange={(e) => setNewCk(e.target.value)}
              placeholder="Adicionar item…"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newCk.trim()) {
                  updateCard(boardId, cardId, {
                    checklist: [...card.checklist, { id: uid('ck'), text: newCk.trim(), done: false }],
                  });
                  setNewCk('');
                }
              }}
            />
            <Button
              variant="outline"
              onClick={() => {
                if (!newCk.trim()) return;
                updateCard(boardId, cardId, {
                  checklist: [...card.checklist, { id: uid('ck'), text: newCk.trim(), done: false }],
                });
                setNewCk('');
              }}
            >
              <Plus size={16} />
            </Button>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-line pt-4">
          <Button
            variant="danger"
            onClick={() => {
              if (colId) removeCard(boardId, colId, cardId);
              onClose();
            }}
          >
            <Trash2 size={16} /> Excluir tarefa
          </Button>
          <Button onClick={onClose}>Concluído</Button>
        </div>
      </div>
    </Modal>
  );
}
