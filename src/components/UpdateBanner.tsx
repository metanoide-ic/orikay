import { RefreshCw } from 'lucide-react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { Button } from './ui';

// De hora em hora o navegador confere se saiu uma versão nova publicada.
const INTERVALO_CHECAGEM_MS = 60 * 60 * 1000;

/**
 * Quando uma atualização é publicada (novo build no GitHub Pages ou no app
 * instalado), este aviso aparece para todo mundo que tiver a plataforma
 * aberta — sem forçar recarregar sozinho, para não interromper ninguém no
 * meio de um trabalho.
 */
export function UpdateBanner() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (!registration) return;
      setInterval(() => registration.update(), INTERVALO_CHECAGEM_MS);
    },
  });

  if (!needRefresh) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 flex justify-center px-4 pb-4">
      <div className="flex items-center gap-3 rounded-2xl border border-brand-400/40 bg-ink-850/95 px-4 py-3 shadow-2xl backdrop-blur">
        <RefreshCw size={16} className="shrink-0 text-brand-300" />
        <div className="text-sm text-white/85">
          Tem uma versão nova da Orikay. Atualiza para pegar o que mudou.
        </div>
        <Button size="sm" onClick={() => updateServiceWorker(true)}>Atualizar agora</Button>
      </div>
    </div>
  );
}
