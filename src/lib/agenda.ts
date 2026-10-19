import { useEffect, useRef } from 'react';
import { useData } from './dataStore';
import { useSettings } from './settingsStore';
import { connectorPath } from './inbox';

/**
 * Mantém o Conector com a lista atual de mensagens automáticas semanais
 * dos clientes. Quem dispara no horário é o Conector (fica ligado o tempo
 * todo); a plataforma só avisa o que existe, sempre que algo muda.
 */
export function useAgendaNoConector(carregado: boolean): void {
  const clients = useData((s) => s.clients);
  const connectorUrl = useSettings((s) => s.connectorUrl);
  const enviado = useRef('');

  useEffect(() => {
    if (!connectorUrl || !carregado) return;
    const itens = clients.flatMap((c) =>
      (c.mensagensSemanais ?? [])
        .filter((m) => m.mensagem.trim() && c.whatsappGroup)
        .map((m) => ({ id: `${c.id}:${m.id}`, grupo: c.whatsappGroup, cliente: c.name, dia: m.dia, hora: m.hora, mensagem: m.mensagem })),
    );
    const corpo = JSON.stringify({ itens });
    if (corpo === enviado.current) return;
    const id = setTimeout(() => {
      fetch(connectorPath(connectorUrl, '/agenda'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: corpo })
        .then((r) => r.json())
        .then((d) => { if (d?.ok) enviado.current = corpo; })
        .catch(() => { /* Conector fechado: tenta de novo na próxima mudança ou abertura */ });
    }, 2_000);
    return () => clearTimeout(id);
  }, [clients, connectorUrl, carregado]);
}
