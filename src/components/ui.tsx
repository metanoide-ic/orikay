import {
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
  useEffect,
} from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
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
    <label className="block space-y-1.5">
      {label && <span className="text-xs font-medium text-white/60">{label}</span>}
      {children}
      {hint && <span className="block text-xs text-white/40">{hint}</span>}
    </label>
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
