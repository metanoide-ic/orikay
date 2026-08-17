import type { Campaign, CampaignDay, Client } from './types';
import { derived } from './ads';
import {
  AREA_LABEL, AREA_ORDEM, FREQUENCIA_LIMITE, PLATFORM_RULES,
  abrangenciaReal, descreverGeo, verbaParaAprender,
} from './adsPlaybook';

/**
 * Diagnóstico das campanhas.
 *
 * Cada regra aqui é uma decisão que um gestor de tráfego experiente tomaria
 * olhando os números. A ideia não é enfeitar a tela com alertas, e sim dizer
 * o que fazer: subir verba, trocar criativo, pausar, mexer na página.
 *
 * Regra da casa: só acusa quando há dado suficiente para sustentar. Alerta
 * cedo demais faz a equipe mexer no que ainda está aprendendo, e mexer no
 * meio do aprendizado é justamente o erro mais caro do tráfego pago.
 */

export type Severidade = 'critico' | 'atencao' | 'oportunidade' | 'ok';

export interface Achado {
  id: string;
  severidade: Severidade;
  titulo: string;
  detalhe: string;
  /** O que fazer, em uma frase. */
  acao: string;
}

export const PESO: Record<Severidade, number> = { critico: 0, atencao: 1, oportunidade: 2, ok: 3 };

/**
 * Ordem de urgência dentro da mesma gravidade. Dinheiro saindo sem retorno
 * vem antes de tudo; ajuste fino de verba vem por último.
 */
const ORDEM = [
  'regiao-ampla',
  'regiao-real-ampla',
  'sem-resultado',
  'converte-mal',
  'cpa-alto',
  'roas-baixo',
  'frequencia',
  'verba-aprendizado',
  'ctr-caindo',
  'cpm-subindo',
  'ctr-baixo',
  'gasto-rapido',
  'gasto-lento',
  'cpa-acima',
  'verba-minima',
  'regiao-divergente',
  'raio-grande',
  'sem-regiao',
  'sem-area-cliente',
  'sem-id',
  'sem-meta',
  'escalar',
  'aprendizado',
];
const urgencia = (id: string) => {
  const i = ORDEM.indexOf(id);
  return i === -1 ? ORDEM.length : i;
};

export const SEV_META: Record<Severidade, { label: string; cor: string }> = {
  critico: { label: 'Crítico', cor: '#f87171' },
  atencao: { label: 'Atenção', cor: '#f59e0b' },
  oportunidade: { label: 'Oportunidade', cor: '#34d399' },
  ok: { label: 'Saudável', cor: '#4b5563' },
};

const soma = (dias: CampaignDay[], campo: keyof CampaignDay) =>
  dias.reduce((a, d) => a + (Number(d[campo]) || 0), 0);

/** Recorta os últimos N dias do histórico. */
function ultimos(history: CampaignDay[] | undefined, n: number): CampaignDay[] {
  if (!history?.length) return [];
  return history.slice(-n);
}

function ctrDe(dias: CampaignDay[]): number {
  const imp = soma(dias, 'impressions');
  return imp ? (soma(dias, 'clicks') / imp) * 100 : 0;
}

function cpmDe(dias: CampaignDay[]): number {
  const imp = soma(dias, 'impressions');
  return imp ? (soma(dias, 'spend') / imp) * 1000 : 0;
}

function diasEntre(de: string, ate: string): number {
  return Math.round((new Date(ate).getTime() - new Date(de).getTime()) / 86400000);
}

/**
 * Analisa uma campanha e devolve os achados, do mais grave para o menos.
 * `hoje` é injetável para o resultado não depender da data em que roda.
 */
export function diagnosticar(
  c: Campaign,
  client?: Client,
  hoje = new Date().toISOString().slice(0, 10),
): Achado[] {
  const achados: Achado[] = [];
  const m = c.metrics;
  const d = derived(m);
  const regras = PLATFORM_RULES[c.platform];
  const hist = c.history ?? [];

  const dias7 = ultimos(hist, 7);
  const dias3 = ultimos(hist, 3);
  const anteriores7 = hist.length >= 10 ? hist.slice(-10, -3) : [];

  const rodando = c.status === 'ativa';
  const diasNoAr = c.startDate ? Math.max(diasEntre(c.startDate, hoje), 0) : undefined;

  // ---------- 1. Ainda aprendendo: não mexer ----------
  const emAprendizado =
    rodando && diasNoAr !== undefined && diasNoAr < regras.diasAprendizado[0];
  if (emAprendizado) {
    achados.push({
      id: 'aprendizado',
      severidade: 'ok',
      titulo: 'Em fase de aprendizado',
      detalhe: `A campanha está no ar há ${diasNoAr} dia(s). Nos primeiros ${regras.diasAprendizado[0]} dias o custo costuma vir de 20% a 50% mais caro e ainda não representa o resultado real.`,
      acao: 'Não mexer em verba, público ou criativo agora: qualquer mudança grande reinicia o aprendizado.',
    });
  }

  // ---------- 2. Verba insuficiente para sair do aprendizado ----------
  // A conta da verba é uma estimativa. Se a campanha já está entregando o
  // volume de eventos que o algoritmo pede, o fato vale mais que a projeção.
  const resultados7 = dias7.length >= 5 ? soma(dias7, 'results') : undefined;
  const jaTemVolume = resultados7 !== undefined && resultados7 >= regras.eventosAprendizado;

  const precisa = verbaParaAprender(c.platform, c.targetCpa);
  if (rodando && c.dailyBudget && !jaTemVolume) {
    if (precisa && c.dailyBudget < precisa * 0.9) {
      achados.push({
        id: 'verba-aprendizado',
        severidade: 'critico',
        titulo: 'Verba baixa demais para o algoritmo aprender',
        detalhe: `Para juntar ${regras.eventosAprendizado} resultados por semana pagando ${fmt(c.targetCpa!)} cada, a campanha precisaria de cerca de ${fmt(precisa)} por dia. Hoje está em ${fmt(c.dailyBudget)}.`,
        acao: `Subir para ${fmt(precisa)} por dia ou juntar os conjuntos, para a verba não ficar espalhada.`,
      });
    } else if (c.dailyBudget < regras.verbaMinimaDia) {
      achados.push({
        id: 'verba-minima',
        severidade: 'atencao',
        titulo: 'Verba abaixo do mínimo da plataforma',
        detalhe: `${c.platform} trabalha mal abaixo de ${fmt(regras.verbaMinimaDia)} por dia. A entrega fica irregular e o custo não estabiliza.`,
        acao: `Subir para pelo menos ${fmt(regras.verbaMinimaDia)} por dia ou concentrar a verba em menos campanhas.`,
      });
    }
  }

  // ---------- 3. Gastou e não trouxe nada ----------
  const tetoSemResultado = (c.targetCpa ?? 0) * 3;
  if (rodando && m.results === 0 && m.spend > 0 && !emAprendizado) {
    const estourou = tetoSemResultado ? m.spend >= tetoSemResultado : m.spend >= regras.verbaMinimaDia * 5;
    if (estourou) {
      achados.push({
        id: 'sem-resultado',
        severidade: 'critico',
        titulo: 'Investimento sem nenhum resultado',
        detalhe: `Já foram ${fmt(m.spend)} sem um único resultado registrado.` +
          (c.targetCpa ? ` Isso é mais de 3 vezes o custo por resultado que você aceita pagar.` : ''),
        acao: 'Pausar e conferir o rastreamento antes de qualquer coisa: muitas vezes o resultado está acontecendo e não está sendo medido.',
      });
    }
  }

  // ---------- 4. Custo por resultado acima da meta ----------
  if (c.targetCpa && m.results > 0 && !emAprendizado) {
    const excesso = d.cpr / c.targetCpa;
    if (excesso >= 1.5) {
      achados.push({
        id: 'cpa-alto',
        severidade: 'critico',
        titulo: 'Custo por resultado muito acima da meta',
        detalhe: `Cada resultado está saindo por ${fmt(d.cpr)}, ${Math.round((excesso - 1) * 100)}% acima dos ${fmt(c.targetCpa)} planejados.`,
        acao: 'Antes de aumentar verba, trocar o criativo e conferir a página de destino: quase sempre o problema está em um dos dois.',
      });
    } else if (excesso >= 1.2) {
      achados.push({
        id: 'cpa-acima',
        severidade: 'atencao',
        titulo: 'Custo por resultado acima da meta',
        detalhe: `Está em ${fmt(d.cpr)} contra a meta de ${fmt(c.targetCpa)}.`,
        acao: 'Cortar o criativo de pior desempenho e deixar a verba com os que estão funcionando.',
      });
    }
  }

  // ---------- 5. Retorno abaixo do esperado ----------
  if (c.targetRoas && m.revenue && m.spend > 0) {
    const roas = m.revenue / m.spend;
    if (roas < c.targetRoas) {
      achados.push({
        id: 'roas-baixo',
        severidade: roas < c.targetRoas * 0.6 ? 'critico' : 'atencao',
        titulo: 'Retorno abaixo do esperado',
        detalhe: `Cada real investido está voltando ${roas.toFixed(2)}, contra a meta de ${c.targetRoas.toFixed(2)}. Faturamento de ${fmt(m.revenue)} para ${fmt(m.spend)} de investimento.`,
        acao: 'Revisar a oferta e o preço médio do pedido. Retorno baixo com custo por venda na meta costuma ser problema de ticket, não de anúncio.',
      });
    }
  }

  // ---------- 6. Fadiga de criativo ----------
  const limite = FREQUENCIA_LIMITE[c.funnel ?? 'topo'];
  if (rodando && m.frequency && m.frequency >= limite) {
    const grave = m.frequency >= limite * 1.5;
    achados.push({
      id: 'frequencia',
      severidade: grave ? 'critico' : 'atencao',
      titulo: 'Criativo cansando o público',
      detalhe: `A mesma pessoa já viu o anúncio ${m.frequency.toFixed(1)} vezes. Nesta etapa do funil o desempenho começa a cair a partir de ${limite}.`,
      acao: 'Entrar com criativo novo no mesmo conjunto, em vez de criar campanha nova: o histórico de aprendizado se aproveita.',
    });
  }

  // ---------- 7. Sinais precoces de desgaste ----------
  if (rodando && dias3.length === 3 && anteriores7.length >= 5) {
    const ctrAgora = ctrDe(dias3);
    const ctrAntes = ctrDe(anteriores7);
    const cpmAgora = cpmDe(dias3);
    const cpmAntes = cpmDe(anteriores7);

    if (ctrAntes > 0 && ctrAgora < ctrAntes * 0.8) {
      achados.push({
        id: 'ctr-caindo',
        severidade: 'atencao',
        titulo: 'Taxa de cliques caindo',
        detalhe: `Nos últimos 3 dias o CTR foi de ${ctrAgora.toFixed(2)}%, contra ${ctrAntes.toFixed(2)}% na semana anterior. As pessoas continuam vendo e deixaram de clicar.`,
        acao: 'Preparar criativo novo agora: esse sinal costuma aparecer de 3 a 5 dias antes da frequência estourar.',
      });
    }
    if (cpmAntes > 0 && cpmAgora > cpmAntes * 1.15 && ctrAgora <= ctrAntes) {
      achados.push({
        id: 'cpm-subindo',
        severidade: 'atencao',
        titulo: 'Custo de entrega subindo',
        detalhe: `O CPM passou de ${fmt(cpmAntes)} para ${fmt(cpmAgora)} sem melhora no CTR. Costuma ser leilão mais disputado ou público saturado.`,
        acao: 'Abrir o público ou trocar o criativo. Se for sazonal (data comemorativa), esperar passar.',
      });
    }
  }

  // ---------- 8. Criativo fraco ----------
  if (rodando && m.impressions > 5000 && d.ctr > 0 && d.ctr < regras.ctrSaudavel * 0.6 && !emAprendizado) {
    achados.push({
      id: 'ctr-baixo',
      severidade: 'atencao',
      titulo: 'Taxa de cliques abaixo do saudável',
      detalhe: `CTR de ${d.ctr.toFixed(2)}% contra os ${regras.ctrSaudavel}% que se espera em ${c.platform}. O anúncio está sendo entregue e ignorado.`,
      acao: 'Problema de criativo ou de oferta, não de verba. Trocar o gancho dos primeiros segundos antes de mexer em qualquer outra coisa.',
    });
  }

  // ---------- 9. Clica mas não converte ----------
  if (m.clicks > 100 && m.results >= 0 && !emAprendizado) {
    const taxa = m.clicks ? (m.results / m.clicks) * 100 : 0;
    if (d.ctr >= regras.ctrSaudavel && taxa < 1) {
      achados.push({
        id: 'converte-mal',
        severidade: 'critico',
        titulo: 'O anúncio funciona, o destino não',
        detalhe: `O CTR está bom (${d.ctr.toFixed(2)}%), mas só ${taxa.toFixed(2)}% de quem clica vira resultado. Foram ${m.clicks} cliques para ${m.results} resultado(s).`,
        acao: 'O gargalo está depois do clique. Conferir velocidade da página, se a promessa do anúncio se repete lá e se o formulário não está longo demais.',
      });
    }
  }

  // ---------- 10. Ritmo de gasto ----------
  if (rodando && c.totalBudget && c.startDate && c.endDate) {
    const total = diasEntre(c.startDate, c.endDate);
    const passados = diasEntre(c.startDate, hoje);
    if (total > 0 && passados > 0 && passados <= total) {
      const esperado = (c.totalBudget * passados) / total;
      const desvio = esperado > 0 ? m.spend / esperado : 1;
      if (desvio > 1.15) {
        achados.push({
          id: 'gasto-rapido',
          severidade: 'atencao',
          titulo: 'Verba saindo mais rápido que o combinado',
          detalhe: `Já foram ${fmt(m.spend)} dos ${fmt(c.totalBudget)}, quando o esperado até hoje era ${fmt(esperado)}. No ritmo atual a verba acaba antes do fim.`,
          acao: 'Baixar a verba diária ou avisar o cliente que o período vai encurtar.',
        });
      } else if (desvio < 0.8) {
        achados.push({
          id: 'gasto-lento',
          severidade: 'atencao',
          titulo: 'Verba sobrando',
          detalhe: `Foram ${fmt(m.spend)} dos ${fmt(c.totalBudget)}, contra ${fmt(esperado)} esperados até hoje. A campanha não está conseguindo entregar.`,
          acao: 'Público estreito ou lance baixo demais. Abrir a segmentação antes que a verba do mês fique parada.',
        });
      }
    }
  }

  // ---------- 11. Hora de escalar ----------
  if (rodando && !emAprendizado && c.targetCpa && m.results >= regras.eventosAprendizado && d.cpr <= c.targetCpa && dias7.length >= 3) {
    const novo = (c.dailyBudget ?? 0) * (1 + regras.passoDeEscala / 100);
    achados.push({
      id: 'escalar',
      severidade: 'oportunidade',
      titulo: 'Campanha pronta para escalar',
      detalhe: `Saiu do aprendizado e entrega a ${fmt(d.cpr)} por resultado, dentro da meta de ${fmt(c.targetCpa)}.`,
      acao: c.dailyBudget
        ? `Subir a verba para ${fmt(novo)} por dia (${regras.passoDeEscala}%) e esperar ${regras.intervaloDeEscala} dias. Aumento maior que isso reinicia o aprendizado.`
        : `Aumentar a verba em até ${regras.passoDeEscala}% de cada vez, com ${regras.intervaloDeEscala} dias entre um aumento e outro.`,
    });
  }

  // ---------- 12. Região: o dinheiro está indo para quem pode comprar? ----------
  const areaCliente = client?.serviceArea;
  const real = abrangenciaReal(c.geoReal);
  const declarada = c.geoMode;

  if (rodando) {
    if (!areaCliente) {
      achados.push({
        id: 'sem-area-cliente',
        severidade: 'atencao',
        titulo: 'Área de atendimento do cliente não cadastrada',
        detalhe: `Sem saber até onde ${client?.name ?? 'o cliente'} atende, não dá para conferir se o anúncio está indo para quem consegue comprar.`,
        acao: 'Preencher a área de atendimento no cadastro do cliente. É o que evita entregar uma pizzaria de bairro para o Brasil inteiro.',
      });
    }

    // O que a plataforma está realmente segmentando manda mais que o combinado.
    if (real && areaCliente && AREA_ORDEM[real] > AREA_ORDEM[areaCliente]) {
      achados.push({
        id: 'regiao-real-ampla',
        severidade: 'critico',
        titulo: 'Anúncio entregando fora da área de atendimento',
        detalhe: `A ${c.platform} está entregando para ${descreverGeo(c.geoReal)}, mas ${client?.name ?? 'o cliente'} atende ${AREA_LABEL[areaCliente].toLowerCase()}. Boa parte da verba está sendo gasta com gente que não tem como comprar.`,
        acao: `Fechar a segmentação no gerenciador para ${AREA_LABEL[areaCliente].toLowerCase()} e conferir se o resultado por real melhora.`,
      });
    } else if (!real && declarada && areaCliente && AREA_ORDEM[declarada] > AREA_ORDEM[areaCliente]) {
      achados.push({
        id: 'regiao-ampla',
        severidade: 'critico',
        titulo: 'Região da campanha maior que a área de atendimento',
        detalhe: `A campanha está combinada para ${AREA_LABEL[declarada].toLowerCase()}, mas ${client?.name ?? 'o cliente'} atende ${AREA_LABEL[areaCliente].toLowerCase()}.`,
        acao: `Reduzir para ${AREA_LABEL[areaCliente].toLowerCase()} antes de mexer em qualquer outra coisa.`,
      });
    }

    if (!declarada && !real) {
      achados.push({
        id: 'sem-regiao',
        severidade: 'critico',
        titulo: 'Campanha sem região definida',
        detalhe: 'Não há registro de onde esta campanha entrega. Campanha sem região costuma sair para o país inteiro, e a verba se dilui em quem nunca vai comprar.',
        acao: 'Definir a região aqui e conferir no gerenciador se bate com o que está no ar.',
      });
    }

    // Combinado x realidade: os dois preenchidos e diferentes.
    if (real && declarada && AREA_ORDEM[real] !== AREA_ORDEM[declarada]) {
      achados.push({
        id: 'regiao-divergente',
        severidade: 'atencao',
        titulo: 'Região no ar diferente da combinada',
        detalhe: `Aqui está registrado ${AREA_LABEL[declarada].toLowerCase()}, mas a plataforma está entregando para ${descreverGeo(c.geoReal)}.`,
        acao: 'Alinhar os dois: ou corrigir no gerenciador, ou atualizar o registro se a mudança foi proposital.',
      });
    }

    // Raio bem maior que o do cliente.
    const raioCampanha = c.geoRadiusKm ?? c.geoReal?.cidades.find((x) => x.raioKm)?.raioKm;
    const raioCliente = client?.serviceRadiusKm;
    if (raioCampanha && raioCliente && raioCampanha > raioCliente * 2) {
      achados.push({
        id: 'raio-grande',
        severidade: 'atencao',
        titulo: 'Raio maior que o de atendimento',
        detalhe: `A campanha alcança ${raioCampanha} km e o cliente atende ${raioCliente} km. Quem está entre os dois vê o anúncio e não consegue ser atendido.`,
        acao: `Fechar o raio em ${raioCliente} km. Se a ideia é testar alcance maior, fazer numa campanha separada para dar para comparar.`,
      });
    }
  }

  // ---------- 13. Sem como acompanhar ----------
  if (rodando && !c.externalId) {
    achados.push({
      id: 'sem-id',
      severidade: 'atencao',
      titulo: 'Campanha sem ID da plataforma',
      detalhe: 'Sem o ID, os números precisam ser digitados à mão e o diagnóstico trabalha com dados velhos.',
      acao: `Abrir a campanha no gerenciador do ${c.platform}, copiar o ID e colar aqui.`,
    });
  }

  // ---------- 14. Sem meta definida ----------
  if (rodando && !c.targetCpa) {
    achados.push({
      id: 'sem-meta',
      severidade: 'atencao',
      titulo: 'Campanha sem meta de custo por resultado',
      detalhe: 'Sem saber quanto vale um resultado para o cliente, não dá para dizer se a campanha está cara ou barata.',
      acao: 'Combinar com o cliente quanto ele aceita pagar por lead ou venda e preencher a meta.',
    });
  }

  return achados.sort(
    (a, b) => PESO[a.severidade] - PESO[b.severidade] || urgencia(a.id) - urgencia(b.id),
  );
}

/** Pior severidade encontrada, para o resumo na tabela. */
export function severidadeGeral(achados: Achado[]): Severidade {
  const reais = achados.filter((a) => a.severidade !== 'ok');
  if (reais.length === 0) return 'ok';
  return reais.reduce<Severidade>((pior, a) => (PESO[a.severidade] < PESO[pior] ? a.severidade : pior), 'oportunidade');
}

function fmt(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 2 });
}
