import { useMemo, useState } from 'react';
import { ChevronDown, Stethoscope } from 'lucide-react';
import { diagnosticar, severidadeGeral, SEV_META, type Achado, type Severidade } from '@/lib/adsDoctor';
import type { Campaign, Client } from '@/lib/types';
import { cn } from '@/lib/utils';

/** Bolinha com a situação da campanha, para a tabela. */
export function SeverityDot({ sev, title }: { sev: Severidade; title?: string }) {
  return (
    <span
      className="inline-block h-2 w-2 shrink-0 rounded-full"
      style={{ background: SEV_META[sev].cor }}
      title={title ?? SEV_META[sev].label}
    />
  );
}

function Item({ achado, campanha }: { achado: Achado; campanha?: string }) {
  // Achado crítico já abre explicado: a equipe precisa do porquê na hora,
  // não depois de caçar onde clicar.
  const [aberto, setAberto] = useState(achado.severidade === 'critico');
  const meta = SEV_META[achado.severidade];
  return (
    <div className="border-t border-line first:border-t-0">
      <button
        onClick={() => setAberto((a) => !a)}
        className="flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-white/[0.02]"
      >
        <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ background: meta.cor }} />
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-baseline gap-x-2">
            <span className="text-sm font-medium text-white">{achado.titulo}</span>
            {campanha && <span className="text-xs text-white/40">{campanha}</span>}
          </span>
          <span className="mt-0.5 block text-sm text-white/55">{achado.acao}</span>
        </span>
        <ChevronDown size={16} className={cn('mt-0.5 shrink-0 text-white/30 transition', aberto && 'rotate-180')} />
      </button>
      {aberto && <p className="px-4 pb-3.5 pl-9 text-sm text-white/50">{achado.detalhe}</p>}
    </div>
  );
}

/**
 * Painel com o que precisa de decisão nas campanhas visíveis, do mais urgente
 * para o menos. É a primeira coisa que a equipe olha ao abrir o Tráfego.
 */
export function CampaignDoctor({ campaigns, clients }: { campaigns: Campaign[]; clients: Record<string, Client> }) {
  const [tudo, setTudo] = useState(false);

  const achados = useMemo(() => {
    const lista: Array<{ achado: Achado; campanha: string }> = [];
    for (const c of campaigns) {
      const nome = c.clientId && clients[c.clientId] ? `${c.name} · ${clients[c.clientId].name}` : c.name;
      const client = c.clientId ? clients[c.clientId] : undefined;
      for (const a of diagnosticar(c, client)) lista.push({ achado: a, campanha: nome });
    }
    return lista;
  }, [campaigns, clients]);

  const acionaveis = achados.filter((x) => x.achado.severidade !== 'ok');
  const criticos = acionaveis.filter((x) => x.achado.severidade === 'critico').length;
  const mostrados = tudo ? acionaveis : acionaveis.slice(0, 5);

  if (campaigns.length === 0) return null;

  return (
    <section className="card mb-4 overflow-hidden">
      <div className="flex items-center gap-2.5 px-4 py-3.5">
        <Stethoscope size={17} className="text-white/50" />
        <h3 className="text-sm font-semibold text-white">Diagnóstico</h3>
        <span className="text-xs text-white/40">
          {acionaveis.length === 0
            ? 'nada pedindo decisão agora'
            : `${acionaveis.length} ponto(s)${criticos ? `, ${criticos} crítico(s)` : ''}`}
        </span>
      </div>

      {acionaveis.length === 0 ? (
        <p className="border-t border-line px-4 py-4 text-sm text-white/45">
          As campanhas estão dentro do esperado. Vale conferir de novo depois de cada troca de criativo
          ou mudança de verba.
        </p>
      ) : (
        <>
          <div className="border-t border-line">
            {mostrados.map((x, i) => (
              <Item key={`${x.achado.id}-${i}`} achado={x.achado} campanha={x.campanha} />
            ))}
          </div>
          {acionaveis.length > 5 && (
            <button
              onClick={() => setTudo((t) => !t)}
              className="w-full border-t border-line px-4 py-2.5 text-xs text-white/45 transition hover:bg-white/[0.02] hover:text-white"
            >
              {tudo ? 'Mostrar menos' : `Ver os outros ${acionaveis.length - 5}`}
            </button>
          )}
        </>
      )}
    </section>
  );
}

/** Diagnóstico de uma campanha só, dentro do modal. */
export function CampaignFindings({ campaign, client }: { campaign: Campaign; client?: Client }) {
  const achados = useMemo(() => diagnosticar(campaign, client), [campaign, client]);
  if (achados.length === 0) return null;
  return (
    <div className="overflow-hidden rounded-xl border border-line">
      <div className="flex items-center gap-2 px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-white/45">
        <SeverityDot sev={severidadeGeral(achados)} />
        Diagnóstico desta campanha
      </div>
      <div className="border-t border-line">
        {achados.map((a) => <Item key={a.id} achado={a} />)}
      </div>
    </div>
  );
}
