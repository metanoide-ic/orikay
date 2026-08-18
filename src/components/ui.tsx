import {
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, ChevronDown, Search, X } from 'lucide-react';
import { cn, initials } from '@/lib/utils';

/* ---------------------------- Button ---------------------------- */
type Variant = 'brand' | 'ghost' | 'outline' | 'soft' | 'danger';
type Size = 'sm' | 'md' | 'lg' | 'icon';

export function Button({
  variant = 'brand',
  size = 'md',
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  const base =
    'inline-flex items-center justify-center gap-2 font-medium rounded-xl transition-all select-none disabled:opacity-40 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/60';
  const variants: Record<Variant, string> = {
    brand: 'btn-brand text-white',
    ghost: 'text-white/70 hover:text-white hover:bg-white/5',
    outline: 'border border-line text-white/80 hover:border-brand-400/60 hover:text-white bg-white/[0.02]',
    soft: 'bg-brand-500/15 text-brand-200 hover:bg-brand-500/25',
    danger: 'bg-red-500/15 text-red-300 hover:bg-red-500/25',
  };
  const sizes: Record<Size, string> = {
    sm: 'h-8 px-3 text-sm',
    md: 'h-10 px-4 text-sm',
    lg: 'h-12 px-6 text-base',
    icon: 'h-9 w-9',
  };
  return (
    <button className={cn(base, variants[variant], sizes[size], className)} {...props}>
      {children}
    </button>
  );
}

/* ---------------------------- Inputs ---------------------------- */
export function Field({
  label,
  hint,
  children,
}: {
  label?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    // Div, não <label>: um <label> reencaminha um clique extra pro primeiro
    // controle "labelable" de dentro (input/button/select), o que quebrava
    // combobox custom com vários botões (ex.: SearchSelect reabria sozinho
    // depois de escolher uma opção).
    <div className="block space-y-1.5">
      {label && <span className="text-xs font-medium text-white/60">{label}</span>}
      {children}
      {hint && <span className="block text-xs text-white/40">{hint}</span>}
    </div>
  );
}

const fieldCls =
  'w-full rounded-xl bg-ink-800/70 border border-line px-3.5 h-11 text-sm text-white placeholder:text-white/30 outline-none transition focus:border-brand-400/70 focus:ring-2 focus:ring-brand-500/20';

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn(fieldCls, props.className)} />;
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={cn(fieldCls, 'h-auto min-h-[90px] py-2.5 leading-relaxed resize-y', props.className)}
    />
  );
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={cn(fieldCls, 'appearance-none pr-9 cursor-pointer', props.className)}
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%23ffffff88' stroke-width='2.5'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E\")",
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'right 0.75rem center',
      }}
    />
  );
}

/* -------------------------- SearchSelect -------------------------- */
/**
 * Combobox pesquisável: mostra o valor escolhido, e ao clicar abre uma
 * lista filtrável por texto — pra escolher rápido entre muitas opções
 * (ex.: cliente) sem rolar um <select> gigante.
 */
export function SearchSelect({
  value,
  onChange,
  options,
  placeholder = 'Buscar…',
  emptyLabel = '—',
}: {
  value: string;
  onChange: (id: string) => void;
  options: Array<{ id: string; label: string; color?: string }>;
  placeholder?: string;
  emptyLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = options.find((o) => o.id === value);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setTimeout(() => inputRef.current?.focus(), 0);
    function onDocClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(fieldCls, 'flex w-full items-center justify-between gap-2 text-left cursor-pointer')}
      >
        <span className={cn('flex min-w-0 items-center gap-2 truncate', !selected && 'text-white/40')}>
          {selected?.color && <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: selected.color }} />}
          <span className="truncate">{selected ? selected.label : emptyLabel}</span>
        </span>
        <ChevronDown size={15} className="shrink-0 text-white/40" />
      </button>

      {open && (
        <div className="absolute z-30 mt-1.5 w-full overflow-hidden rounded-xl border border-line bg-ink-800 shadow-2xl">
          <div className="flex items-center gap-2 border-b border-line px-3 py-2">
            <Search size={14} className="shrink-0 text-white/35" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={placeholder}
              className="w-full bg-transparent text-sm text-white placeholder:text-white/30 outline-none"
            />
          </div>
          <div className="max-h-56 overflow-y-auto py-1">
            <button
              type="button"
              onClick={() => { onChange(''); setOpen(false); }}
              className={cn('flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-white/60 hover:bg-white/[0.06]', !value && 'text-brand-300')}
            >
              {emptyLabel}
              {!value && <Check size={13} className="ml-auto shrink-0" />}
            </button>
            {filtered.length === 0 && (
              <div className="px-3 py-3 text-center text-xs text-white/35">Nada encontrado.</div>
            )}
            {filtered.map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => { onChange(o.id); setOpen(false); }}
                className={cn('flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-white/85 hover:bg-white/[0.06]', o.id === value && 'text-brand-300')}
              >
                {o.color && <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: o.color }} />}
                <span className="truncate">{o.label}</span>
                {o.id === value && <Check size={13} className="ml-auto shrink-0" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------------------- Badge ----------------------------- */
export function Badge({
  children,
  color,
  className,
}: {
  children: ReactNode;
  color?: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-[11px] font-medium',
        className,
      )}
      style={
        color
          ? { background: `${color}22`, color, boxShadow: `inset 0 0 0 1px ${color}44` }
          : undefined
      }
    >
      {children}
    </span>
  );
}

/* ---------------------------- Switch ------------------------------ */
export function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors',
        checked ? 'bg-brand-500' : 'bg-white/10',
      )}
    >
      <span
        className={cn(
          'inline-block h-[18px] w-[18px] transform rounded-full bg-white shadow transition-transform',
          checked ? 'translate-x-6' : 'translate-x-1',
        )}
      />
    </button>
  );
}

/* ------------------------- AttachmentsGallery ------------------------- */
/**
 * Galeria de anexos (imagens) de um post/vídeo: grade de miniaturas, a
 * primeira é a capa que aparece no cartão do quadro. Clica numa miniatura
 * pra ver grande, "Definir como capa" reordena, X remove. Aceita mandar
 * várias imagens de uma vez.
 */
export function AttachmentsGallery({
  items,
  onAdd,
  onRemove,
  onMakeCover,
}: {
  items: string[];
  onAdd: (dataUrls: string[]) => void;
  onRemove: (index: number) => void;
  onMakeCover: (index: number) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<number | null>(null);

  function onFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const readers = Array.from(files).map(
      (f) =>
        new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.readAsDataURL(f);
        }),
    );
    Promise.all(readers).then(onAdd);
    e.target.value = '';
  }

  return (
    <div>
      <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={onFiles} />
      <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4">
        {items.map((url, i) => (
          <div key={i} className="group relative aspect-square overflow-hidden rounded-xl border border-line bg-white/[0.02]">
            <img src={url} alt="" className="h-full w-full cursor-pointer object-cover" onClick={() => setPreview(i)} />
            {i === 0 && (
              <span className="absolute left-1.5 top-1.5 rounded-md bg-black/70 px-1.5 py-0.5 text-[10px] font-medium text-white/85">Capa</span>
            )}
            <div className="absolute inset-x-0 bottom-0 flex items-center justify-end gap-1 bg-gradient-to-t from-black/70 to-transparent p-1.5 opacity-0 transition group-hover:opacity-100">
              {i !== 0 && (
                <button
                  type="button"
                  onClick={() => onMakeCover(i)}
                  className="rounded-md bg-black/60 px-1.5 py-1 text-[10px] font-medium text-white/85 hover:text-brand-300"
                  title="Definir como capa"
                >
                  Definir capa
                </button>
              )}
              <button
                type="button"
                onClick={() => onRemove(i)}
                className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-black/60 text-white/70 hover:text-red-300"
                title="Remover"
              >
                <X size={13} />
              </button>
            </div>
          </div>
        ))}
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-line text-white/40 hover:border-brand-400/50 hover:text-white"
        >
          <span className="text-xl leading-none">+</span>
          <span className="text-[10px]">Anexar</span>
        </button>
      </div>

      {preview !== null && items[preview] && createPortal(
        <div className="fixed inset-0 z-[60] grid place-items-center bg-black/85 p-6" onClick={() => setPreview(null)}>
          <img src={items[preview]} alt="" className="max-h-[85vh] max-w-full rounded-xl object-contain" />
          <button
            onClick={() => setPreview(null)}
            className="absolute right-5 top-5 grid h-9 w-9 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20"
          >
            <X size={18} />
          </button>
        </div>,
        document.body,
      )}
    </div>
  );
}

/* ---------------------------- Avatar ---------------------------- */
export function Avatar({
  name,
  color,
  size = 32,
}: {
  name: string;
  color: string;
  size?: number;
}) {
  return (
    <div
      className="grid place-items-center rounded-full font-semibold text-white shrink-0"
      style={{ width: size, height: size, background: color, fontSize: size * 0.38 }}
      title={name}
    >
      {initials(name)}
    </div>
  );
}

/* ---------------------------- Modal ----------------------------- */
export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 grid place-items-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            className={cn('relative card w-full p-5 sm:p-6 shadow-2xl', wide ? 'max-w-2xl' : 'max-w-md')}
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
          >
            {title && (
              <div className="mb-4 flex items-center justify-between gap-4">
                <h3 className="text-lg font-semibold text-white">{title}</h3>
                <Button variant="ghost" size="icon" onClick={onClose} aria-label="Fechar">
                  <X size={18} />
                </Button>
              </div>
            )}
            <div className="max-h-[70vh] overflow-y-auto -mx-1 px-1">{children}</div>
            {footer && <div className="mt-5 flex justify-end gap-2">{footer}</div>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

/* ----------------------------- Stat ----------------------------- */
export function Stat({
  label,
  value,
  hint,
  dot,
  valueColor,
}: {
  label: string;
  value: string;
  hint?: string;
  dot?: string;
  valueColor?: string;
}) {
  return (
    <div className="card p-5">
      <div className="flex items-center gap-2">
        {dot && <span className="h-1.5 w-1.5 rounded-full" style={{ background: dot }} />}
        <span className="text-[11px] font-medium uppercase tracking-wider text-white/45">{label}</span>
      </div>
      <div className="mt-2 font-display text-2xl font-semibold tabular-nums" style={{ color: valueColor || '#fff' }}>
        {value}
      </div>
      {hint && <div className="mt-1 text-xs text-white/40">{hint}</div>}
    </div>
  );
}

/* ---------------------------- Empty ----------------------------- */
export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="grid place-items-center rounded-2xl border border-dashed border-line py-16 text-center">
      {icon && <div className="mb-3 text-brand-300/70">{icon}</div>}
      <h4 className="text-base font-semibold text-white">{title}</h4>
      {description && <p className="mt-1 max-w-sm text-sm text-white/50">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
