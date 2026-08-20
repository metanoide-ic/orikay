import { useRegisterSW } from 'virtual:pwa-register/react';

// A cada 5 minutos o navegador confere se saiu uma versão nova publicada.
const INTERVALO_CHECAGEM_MS = 5 * 60 * 1000;

/**
 * Mantém a plataforma sempre na versão mais nova, sozinha: registra o
 * service worker e confere de tempos em tempos se saiu versão nova — quando
 * sai, o `registerType: 'autoUpdate'` (vite.config.ts) aplica e recarrega
 * na hora, sem depender de ninguém clicar em aviso. Antes era um banner
 * "Atualizar agora": quem ignorava ficava preso numa versão velha pra
 * sempre e reportava como bug coisa já corrigida. Recarregar não perde
 * nada — todo o trabalho é salvo a cada mudança (e sincronizado).
 */
export function UpdateBanner() {
  useRegisterSW({
    immediate: true,
    onRegisteredSW(_url, registration) {
      if (!registration) return;
      setInterval(() => registration.update(), INTERVALO_CHECAGEM_MS);
    },
  });
  return null;
}
