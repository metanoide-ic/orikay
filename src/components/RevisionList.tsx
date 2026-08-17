import { useState } from 'react';
import { Plus, Check, X } from 'lucide-react';
import { Button } from './ui';
import { cn } from '@/lib/utils';
import type { Revision } from '@/lib/types';

/**
 * Lista de pedidos de alteração — cada um separado, empilhado um embaixo do outro,
 * com campo próprio para escrever o que mudar.
 */
export function RevisionList({
  revisions,
  onAdd,
  onToggle,
  onRemove,
}: {
  revisions: Revision[];
  onAdd: (text: string) => void;
  onToggle?: (id: string) => void;
  onRemove?: (id: string) => void;
}) {
  const [text, setText] = useState('');
  const pend = revisions.filter((r) => !r.resolved).length;

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-medium text-white/60">
          Alterações solicitadas {revisions.length > 0 && `· ${pend} pendente(s)`}
        </span>
      </div>

      <div className="space-y-2">
        {revisions.map((r, i) => (
          <div
            key={r.id}
            className={cn(
              'group flex items-start gap-2.5 rounded-xl border p-3',
              r.resolved ? 'border-line bg-white/[0.02]' : 'border-rose-500/30 bg-rose-500/[0.06]',
            )}
          >
            {onToggle && (
              <button
                onClick={() => onToggle(r.id)}
                className={cn(
                  'mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md border transition',
                  r.resolved ? 'border-emerald-400 bg-emerald-500 text-white' : 'border-rose-400/60 text-transparent hover:border-emerald-400',
                )}
                title={r.resolved ? 'Reabrir' : 'Marcar como resolvido'}
              >
                <Check size={13} />
              </button>
            )}
            <div className="min-w-0 flex-1">
              <div className="mb-0.5 text-[11px] font-medium text-rose-300/80">Alteração #{i + 1}</div>
              <p className={cn('text-sm', r.resolved ? 'text-white/40 line-through' : 'text-white/90')}>
                {r.text}
              </p>
            </div>
            {onRemove && (
              <button
                onClick={() => onRemove(r.id)}
                className="text-white/20 opacity-0 transition hover:text-red-300 group-hover:opacity-100"
              >
                <X size={14} />
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="mt-2 flex gap-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Escreva uma alteração…"
          rows={1}
          className="min-h-[44px] w-full resize-y rounded-xl border border-line bg-ink-800/70 px-3.5 py-2.5 text-sm text-white placeholder:text-white/30 outline-none focus:border-brand-400/70"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && text.trim()) {
              onAdd(text.trim());
              setText('');
            }
          }}
        />
        <Button
          variant="outline"
          onClick={() => {
            if (!text.trim()) return;
            onAdd(text.trim());
            setText('');
          }}
        >
          <Plus size={16} />
        </Button>
      </div>
    </div>
  );
}
