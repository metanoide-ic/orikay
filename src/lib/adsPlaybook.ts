import type { AdPlatform, Campaign, CampaignFunnel, CampaignObjective, Client, GeoReal, ServiceArea } from './types';

/**
 * Números de referência do tráfego pago, por plataforma.
 *
 * Não são chutes: vêm do que cada plataforma documenta e do que o mercado
 * mede. Ficam todos aqui, num lugar só, para serem ajustados conforme a
 * agência acumular histórico próprio — o benchmark da casa sempre vale mais
 * que a média do mercado.
 */

/**
 * Câmbio aproximado usado só nos mínimos de verba, que as plataformas
 * publicam em dólar. Serve para ordem de grandeza, não para contabilidade.
 */
const USD = 5.5;

export interface PlatformRules {
  /** Eventos de conversão por semana para o algoritmo sair do aprendizado. */
  eventosAprendizado: number;
  /** Dias que o aprendizado costuma levar. */
  diasAprendizado: [number, number];
  /** Verba diária mínima que a plataforma exige ou recomenda, em reais. */
  verbaMinimaDia: number;
  /** CTR de link considerado saudável (%). Abaixo disso, o criativo pesa. */
  ctrSaudavel: number;
  /** Quanto se pode subir a verba sem reiniciar o aprendizado (%). */
  passoDeEscala: number;
  /** Dias a esperar entre dois aumentos de verba. */
  intervaloDeEscala: number;
}

export const PLATFORM_RULES: Record<AdPlatform, PlatformRules> = {
  // Meta: 50 eventos por conjunto em 7 dias para sair do aprendizado, e
  // mudanças acima de 20% na verba reiniciam a fase.
  Meta: {
    eventosAprendizado: 50,
    diasAprendizado: [7, 14],
    verbaMinimaDia: 20,
    ctrSaudavel: 1,
    passoDeEscala: 20,
    intervaloDeEscala: 3,
  },
  // Google (Performance Max): o teste recomendado começa em US$ 50 a 100 por
  // dia e o algoritmo pede semanas para amadurecer.
  Google: {
    eventosAprendizado: 30,
    diasAprendizado: [14, 42],
    verbaMinimaDia: Math.round(50 * USD),
    ctrSaudavel: 2,
    passoDeEscala: 20,
    intervaloDeEscala: 7,
  },
  // TikTok: mínimo de US$ 20 por dia por conjunto, e campanhas de conversão
  // pedem bem mais que isso para estabilizar.
  TikTok: {
    eventosAprendizado: 50,
    diasAprendizado: [10, 15],
    verbaMinimaDia: Math.round(20 * USD),
    ctrSaudavel: 1,
    passoDeEscala: 20,
    intervaloDeEscala: 3,
  },
};

/**
 * Teto de frequência por etapa do funil, medido em 7 dias. Em prospecção o
 * desempenho começa a cair passando de 2,5 e despenca perto de 4. Em
 * remarketing, com a intenção já estabelecida, 5 ainda é aceitável.
 */
export const FREQUENCIA_LIMITE: Record<CampaignFunnel, number> = {
  topo: 2.5,
  meio: 3.5,
  fundo: 5,
};

export const FUNNEL_LABEL: Record<CampaignFunnel, string> = {
  topo: 'Prospecção (quem não conhece)',
  meio: 'Consideração (já teve contato)',
  fundo: 'Remarketing (já demonstrou interesse)',
};

/* ------------------------------ Geografia ----------------------------- */

export const AREA_LABEL: Record<ServiceArea, string> = {
  raio: 'Raio em volta do endereço',
  cidade: 'Cidade',
  regiao: 'Cidade e vizinhas',
  estado: 'Estado',
  nacional: 'Brasil inteiro',
};

/** Do mais estreito para o mais amplo. Serve para comparar abrangências. */
export const AREA_ORDEM: Record<ServiceArea, number> = {
  raio: 0, cidade: 1, regiao: 2, estado: 3, nacional: 4,
};

/**
 * Raio padrão por tipo de atendimento, em km. Um restaurante que entrega
 * trabalha em outra escala de uma clínica que atende a cidade toda.
 */
export const RAIO_PADRAO_KM = 8;

/** Descreve em uma linha o que a plataforma está de fato segmentando. */
export function descreverGeo(geo?: GeoReal): string {
  if (!geo || geo.desconhecido) return 'não foi possível ler a segmentação';
  const partes: string[] = [];
  if (geo.cidades.length) {
    partes.push(
      geo.cidades
        .map((c) => (c.raioKm ? `${c.nome} (${c.raioKm} km)` : c.nome))
        .join(', '),
    );
  }
  if (geo.estados.length) partes.push(geo.estados.join(', '));
  if (geo.paises.length && !geo.cidades.length && !geo.estados.length) {
    partes.push(geo.paises.includes('BR') ? 'Brasil inteiro' : geo.paises.join(', '));
  }
  return partes.length ? partes.join(' e ') : 'sem região definida';
}

/**
 * Traduz a segmentação lida da plataforma para a mesma escala da área de
 * atendimento, para dar para comparar as duas.
 */
export function abrangenciaReal(geo?: GeoReal): ServiceArea | undefined {
  if (!geo || geo.desconhecido) return undefined;
  if (geo.cidades.length) {
    const comRaio = geo.cidades.every((c) => c.raioKm !== undefined);
    if (comRaio && geo.cidades.length === 1) return 'raio';
    return geo.cidades.length > 1 ? 'regiao' : 'cidade';
  }
  if (geo.estados.length) return 'estado';
  if (geo.paises.length) return 'nacional';
  return undefined;
}

/** Área de atendimento combinada com o cliente, com um padrão sensato. */
export function areaDoCliente(client?: Client): ServiceArea | undefined {
  return client?.serviceArea;
}

/** Objetivos em que faz sentido cobrar retorno em dinheiro. */
export const OBJETIVO_COM_ROAS: CampaignObjective[] = ['Vendas'];

/**
 * Verba diária mínima para a campanha conseguir sair do aprendizado dentro
 * de uma semana: custo por resultado desejado x eventos necessários / 7.
 */
export function verbaParaAprender(platform: AdPlatform, targetCpa?: number): number | undefined {
  if (!targetCpa) return undefined;
  const r = PLATFORM_RULES[platform];
  return (targetCpa * r.eventosAprendizado) / 7;
}

/** Verba diária mínima considerando o piso da plataforma e a meta de custo. */
export function verbaMinimaRecomendada(platform: AdPlatform, targetCpa?: number): number {
  const piso = PLATFORM_RULES[platform].verbaMinimaDia;
  const aprendizado = verbaParaAprender(platform, targetCpa);
  return Math.max(piso, aprendizado ?? 0);
}

export interface Playbook {
  estrutura: string;
  criativos: string;
  publico: string;
  medicao: string;
  regiao: string;
}

/** Como montar a campanha, por objetivo. O que a experiência já sabe. */
export function playbook(platform: AdPlatform, objective: CampaignObjective): Playbook {
  const base: Record<CampaignObjective, Playbook> = {
    Vendas: {
      estrutura: 'Uma campanha por oferta, poucos conjuntos. Dividir a verba em muitos conjuntos é o motivo mais comum de nunca sair do aprendizado.',
      criativos: 'De 3 a 5 criativos por conjunto, misturando formatos. Trocar o que cansou, não a campanha inteira.',
      publico: 'Começar amplo em interesse e deixar o algoritmo achar. Amplo em interesse não é amplo em mapa: a região continua fechada.',
      medicao: 'Otimizar pela compra, não por adicionar ao carrinho. Evento barato ensina a plataforma a buscar quem nunca compra.',
      regiao: 'Loja física entrega só onde o cliente consegue atender. E-commerce que envia para o país todo é a única exceção.',
    },
    Leads: {
      estrutura: 'Formulário nativo converte mais barato; página própria traz lead mais qualificado. Testar os dois antes de decidir.',
      criativos: 'A oferta precisa estar clara nos 3 primeiros segundos. Falar do problema, não da empresa.',
      publico: 'Amplo com o criativo filtrando. Se vier lead ruim, apertar a pergunta do formulário antes de apertar o público.',
      medicao: 'Acompanhar o lead até a venda. Custo por lead baixo com lead que não fecha é prejuízo disfarçado.',
      regiao: 'Lead de fora da área de atendimento é dinheiro jogado fora, e ainda ensina o algoritmo a buscar mais gente igual.',
    },
    Mensagens: {
      estrutura: 'Campanha de mensagem só compensa com alguém respondendo rápido do outro lado. Combinar o plantão antes de subir.',
      criativos: 'Chamada direta para conversar, com a dúvida mais comum do cliente já respondida.',
      publico: 'Raio pequeno em volta do ponto de venda, quando o negócio é local.',
      medicao: 'Contar conversa iniciada e, principalmente, conversa que virou venda.',
      regiao: 'O caso mais sensível: pizzaria, salão e clínica só devem aparecer para quem consegue chegar até lá. Raio de 5 a 10 km resolve a maioria.',
    },
    Tráfego: {
      estrutura: 'Serve para aquecer público e testar criativo, não para vender. Se o objetivo é venda, usar campanha de venda.',
      criativos: 'Testar muitas variações baratas aqui e levar as vencedoras para a campanha de conversão.',
      publico: 'Amplo. O barato aqui é justamente o volume.',
      medicao: 'Olhar tempo na página, não só clique. Clique que sai em 2 segundos não vale nada.',
      regiao: 'Mesmo para aquecer público, manter a região do cliente: público de remarketing formado com gente de fora não serve para nada depois.',
    },
    Engajamento: {
      estrutura: 'Bom para construir público de remarketing e prova social no perfil.',
      criativos: 'Conteúdo que já foi bem no orgânico costuma render mais barato aqui.',
      publico: 'Amplo, com interesse ligado ao tema do conteúdo.',
      medicao: 'Medir crescimento do público de remarketing, não curtida por curtida.',
      regiao: 'Seguidor de outro estado infla o número e não compra. Manter a região de atendimento.',
    },
    Reconhecimento: {
      estrutura: 'Campanha de marca, resultado no médio prazo. Não cobrar venda dela.',
      criativos: 'Mensagem única e repetida. Aqui a repetição trabalha a favor, até o limite da frequência.',
      publico: 'Toda a região de atuação do cliente.',
      medicao: 'Alcance e frequência, mais busca pelo nome da marca ao longo dos meses.',
      regiao: 'Aqui vale abrir um pouco além da área de atendimento, mas sem sair da cidade ou região.',
    },
  };

  const p = { ...base[objective] };

  if (platform === 'TikTok') {
    p.criativos = 'Vídeo vertical no jeito do feed: anúncio com cara de anúncio rende bem menos. Os 3 primeiros segundos decidem tudo. ' + p.criativos;
  }
  if (platform === 'Google') {
    p.estrutura = 'No Performance Max, separar produtos de margem alta e baixa em grupos diferentes, e excluir as buscas pelo nome da marca (elas já viriam de graça). ' + p.estrutura;
  }
  return p;
}

/** Monta a URL com UTMs a partir da campanha. */
export function buildUtm(c: Pick<Campaign, 'landingUrl' | 'platform' | 'name' | 'objective'>): string {
  if (!c.landingUrl) return '';
  const limpo = (t: string) => t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  try {
    const url = new URL(c.landingUrl.startsWith('http') ? c.landingUrl : `https://${c.landingUrl}`);
    url.searchParams.set('utm_source', limpo(c.platform));
    url.searchParams.set('utm_medium', 'cpc');
    url.searchParams.set('utm_campaign', limpo(c.name));
    url.searchParams.set('utm_content', limpo(c.objective));
    return url.toString();
  } catch {
    return '';
  }
}
