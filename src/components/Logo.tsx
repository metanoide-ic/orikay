import { cn } from '@/lib/utils';

/**
 * Marca Orikay: o "O" aberto pela direita e o "K" reduzido às duas pernas,
 * encaixadas na abertura do anel. Monocromática de propósito — herda a cor
 * do texto, então funciona no tema escuro e em fundos claros.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={cn('block text-ink-50', className)} aria-hidden="true">
      {/* Anel aberto: arco puro, sem máscara, para não facetar ao rasterizar. */}
      <path
        d="M54.71 30.08 A26 26 0 1 0 54.71 69.92"
        fill="none" stroke="currentColor" strokeWidth="14"
      />
      {/* Pernas do K, partindo do vértice dentro da abertura do anel. */}
      <path d="M58 50 L78 20 L94 20 L74 50 Z" fill="currentColor" />
      <path d="M58 50 L78 80 L94 80 L74 50 Z" fill="currentColor" />
    </svg>
  );
}

export function Logo({
  className,
  showTagline = true,
  size = 'md',
}: {
  className?: string;
  showTagline?: boolean;
  size?: 'sm' | 'md' | 'lg';
}) {
  const mark = { sm: 'h-8 w-8', md: 'h-10 w-10', lg: 'h-14 w-14' }[size];
  const word = { sm: 'text-xl', md: 'text-2xl', lg: 'text-4xl' }[size];
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <LogoMark className={mark} />
      <div className="leading-none">
        <div className={cn('font-display font-semibold tracking-tight text-ink-50', word)}>
          Orikay
        </div>
        {showTagline && (
          <div className="mt-1 text-[9px] font-medium tracking-[0.28em] text-ink-400">
            COMUNICAÇÃO &amp; MARKETING
          </div>
        )}
      </div>
    </div>
  );
}
