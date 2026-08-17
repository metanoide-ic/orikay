import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Search, X } from 'lucide-react';
import type { Client } from '@/lib/types';
import { cn } from '@/lib/utils';

/**
 * Filtro de cliente para as telas de trabalho.
 *
 * Com poucos clientes uma fileira de botões funcionava; com a carteira
 * inteira (40+, contando os agentes Omni) ela virava cinco linhas de tela.
 * Aqui vira um seletor só, com busca, que abre embaixo do botão.
 */
export function ClientFilter({
  clients,
  value,
  onChange,
}: {
  clients: Client[];
  value: string;
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [busca, setBusca] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const atual = clients.find((c) => c.id === value);

  const visiveis = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter((c) => c.name.toLowerCase().includes(q));
  }, [clients, busca]);

  useEffect(() => {
    if (open) {
      setBusca('');
      // foco depois de montar, para digitar direto
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  if (clients.length === 0) return null;

  function escolher(id: string) {
    onChange(id);
    setOpen(false);
  }

  return (
    <div className="relative mb-4 inline-block">
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => setOpen((o) => !o)}
          className={cn(
            'inline-flex h-9 items-center gap-2 rounded-lg border border-line bg-ink-850 px-3 text-sm transition hover:border-white/25',
            atual ? 'text-white' : 'text-white/55',
          )}
        >
          {atual ? (
            <>
              <span className="h-2 w-2 rounded-full" style={{ background: atual.color }} />
              <span className="max-w-[14rem] truncate font-medium">{atual.name}</span>
            </>
          ) : (
            <span>Todos os clientes</span>
          )}
          <ChevronDown size={15} className={cn('text-white/35 transition', open && 'rotate-180')} />
        </button>
        {atual && (
          <button
            onClick={() => onChange('')}
            className="grid h-9 w-9 place-items-center rounded-lg text-white/40 transition hover:bg-white/5 hover:text-white"
            aria-label="Limpar filtro de cliente"
          >
            <X size={15} />
          </button>
        )}
      </div>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 z-50 mt-2 w-80 overflow-hidden rounded-xl border border-line bg-ink-850 shadow-2xl">
            <div className="flex items-center gap-2 border-b border-line px-3">
              <Search size={15} className="shrink-0 text-white/35" />
              <input
                ref={inputRef}
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') setOpen(false);
                  if (e.key === 'Enter' && visiveis.length === 1) escolher(visiveis[0].id);
                }}
                placeholder="Buscar cliente"
                className="h-10 w-full bg-transparent text-sm text-white outline-none placeholder:text-white/30"
              />
            </div>
            <div className="max-h-72 overflow-y-auto p-1">
              <button
                onClick={() => escolher('')}
                className={cn(
                  'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition hover:bg-white/5',
                  !value ? 'text-white' : 'text-white/60',
                )}
              >
                <span className="w-2" />
                <span className="flex-1">Todos os clientes</span>
                {!value && <Check size={14} className="text-brand-300" />}
              </button>
              {visiveis.map((c) => (
                <button
                  key={c.id}
                  onClick={() => escolher(c.id)}
                  className={cn(
                    'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition hover:bg-white/5',
                    value === c.id ? 'text-white' : 'text-white/60',
                  )}
                >
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: c.color }} />
                  <span className="flex-1 truncate">{c.name}</span>
                  {value === c.id && <Check size={14} className="text-brand-300" />}
                </button>
              ))}
              {visiveis.length === 0 && (
                <p className="px-3 py-4 text-center text-sm text-white/35">Nenhum cliente com esse nome.</p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
