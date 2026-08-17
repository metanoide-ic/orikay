import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';

export interface ContextMenuItem {
  label: string;
  icon?: ReactNode;
  onSelect: () => void;
  danger?: boolean;
  disabled?: boolean;
}

/** Menu de botão direito, estilo Trello: some ao clicar fora ou apertar Esc. */
export function ContextMenu({ x, y, items, onClose }: { x: number; y: number; items: ContextMenuItem[]; onClose: () => void }) {
  useEffect(() => {
    const fechar = () => onClose();
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('click', fechar);
    window.addEventListener('contextmenu', fechar);
    window.addEventListener('keydown', tecla);
    return () => {
      window.removeEventListener('click', fechar);
      window.removeEventListener('contextmenu', fechar);
      window.removeEventListener('keydown', tecla);
    };
  }, [onClose]);

  // Evita o menu nascer fora da tela quando o clique é perto da borda direita/inferior.
  const left = Math.min(x, window.innerWidth - 232);
  const top = Math.min(y, window.innerHeight - items.length * 38 - 16);

  return createPortal(
    <div
      className="fixed z-[100] w-56 overflow-hidden rounded-xl border border-line bg-ink-850 py-1.5 shadow-2xl"
      style={{ left, top }}
      onClick={(e) => e.stopPropagation()}
    >
      {items.map((it, i) => (
        <button
          key={i}
          disabled={it.disabled}
          onClick={() => { it.onSelect(); onClose(); }}
          className={cn(
            'flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm transition',
            it.disabled ? 'cursor-not-allowed text-white/25' : it.danger ? 'text-red-300 hover:bg-red-500/10' : 'text-white/80 hover:bg-white/5',
          )}
        >
          {it.icon}{it.label}
        </button>
      ))}
    </div>,
    document.body,
  );
}
