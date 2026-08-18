import type { BillingMethod, Board, Client, ServiceArea, WeeklyPlan, WorkspaceData } from './types';
import { uid } from './utils';

/**
 * Base inicial da agência: a carteira real de clientes, com briefing e
 * cadência semanal já preenchidos.
 *
 * Não há dados de exemplo aqui. Quadros, posts, vídeos e financeiro nascem
 * vazios, para a equipe começar a trabalhar em cima do que é de verdade.
 */

/** Dias da semana: 1 = segunda ... 5 = sexta. */
const SEG = 1, TER = 2, QUA = 3, QUI = 4, SEX = 5;

/** Municípios do Sul Fluminense atendidos pelos clientes regionais. */
const SUL_FLUMINENSE = [
  'Barra Mansa', 'Volta Redonda', 'Resende', 'Barra do Piraí', 'Piraí',
  'Valença', 'Pinheiral', 'Quatis', 'Porto Real', 'Itatiaia', 'Rio Claro',
];

interface Entrada {
  nome: string;
  cor: string;
  briefing: string;
  cadencia: WeeklyPlan;
  area: ServiceArea;
  cidades?: string[];
  /** Observação de operação, quando o combinado foge do padrão. */
  nota?: string;
  /** Contrato mensal, dia de vencimento e forma combinada. */
  fee?: number;
  dia?: number;
  forma?: BillingMethod;
  /** Razão social ou nome de quem paga, como aparece no controle. */
  pagador?: string;
}

/**
 * Agentes Omni. Cada um é um correspondente bancário em uma praça, fatura
 * separado e tem a própria cidade, mas o conteúdo é o mesmo para todos:
 * é produzido uma vez em "Banco Omni" e distribuído.
 */
const AGENTES_OMNI: Array<[string, string, number, number, BillingMethod?, string?]> = [
  ['Omni Cotia', 'Cotia', 1500, 5, 'pix', 'TIRAL'],
  ['Omni Jaú', 'Jaú', 1500, 5, 'pix', 'EDMAR MORETTI'],
  ['Omni Juiz de Fora', 'Juiz de Fora', 1500, 5, 'pix', 'CONQUISTA INTERMED'],
  ['Omni Jaguariúna', 'Jaguariúna', 1500, 10, 'pix', 'Artur Nogueira'],
  ['Omni Guaratinguetá', 'Guaratinguetá', 1500, 10, 'pix', 'Beelinho'],
  ['Omni Passo Fundo', 'Passo Fundo', 1500, 10, 'pix', 'EVOLUCAO INTERMED'],
  ['Omni São Bernardo do Campo', 'São Bernardo do Campo', 1000, 10, 'pix', 'ACS INTERMED'],
  ['Omni Taubaté', 'Taubaté', 1000, 10, 'pix', 'Garbelotto'],
  ['Omni Zona Sul SP', 'São Paulo', 1000, 10, 'pix'],
  ['Omni Franca', 'Franca', 2000, 20, 'pix', 'LD CADASTRAMENTO / MINAS SERV'],
  ['Omni Jundiaí', 'Jundiaí', 1500, 20, 'pix', 'YOSI NEGOCIOS'],
  ['Omni Limeira', 'Limeira', 2000, 20, 'pix', 'OPMAZETTI'],
  ['Omni Volta Redonda', 'Volta Redonda', 1500, 20, 'pix', 'VIVAMAR INTERMED'],
  ['Omni Rio de Janeiro', 'Rio de Janeiro', 1000, 20, 'pix', 'VIVAMAR INTERMED (Zona Oeste)'],
  ['Omni Jacareí', 'Jacareí', 1000, 30, 'boleto', 'SERVCAR'],
  ['Omni Linhares', 'Linhares', 1000, 30, 'boleto', 'CONTROLE INTERMED'],
  ['Omni Uberaba', 'Uberaba', 1000, 30, 'pix', 'CARVALHO INTERMED'],
];

const CARTEIRA: Entrada[] = [
  {
    nome: 'Banco Omni',
    cor: '#2563eb',
    area: 'nacional',
    cadencia: { [TER]: ['Vídeo'], [QUA]: ['Post'], [SEX]: ['Post'] },
    briefing:
      'Financeira focada em financiamento e refinanciamento de carros, motos e caminhões. No mercado desde 1994 (27 anos de atuação), com mais de 4,7 milhões de clientes atendidos e rede de mais de 100 correspondentes exclusivos (Agentes Omni) espalhados por 13 estados do Brasil. Faz parte do Conglomerado Prudencial Omni, autorizado pelo Banco Central. Trabalha por uma rede de Agentes Omni, correspondentes bancários espalhados pelo Brasil: o mesmo conteúdo serve para todos os agentes, e só feirões e ações locais pedem peça exclusiva. Comunicação popular, comercial e voltada à conversão. Azul royal, branco e laranja, com veículos, pessoas reais, movimento e headlines curtas de grande impacto. Pautas recorrentes: feirões, ações em loja, refinanciamento, Plano Renova, campanhas sazonais e material para correspondentes e lojistas.',
    nota: 'Conteúdo único para todos os agentes. Os agentes ficam em praças diferentes, inclusive em outros estados, então feirão e ação local entram como peça extra com a cidade daquele agente. Números de mercado (anos de atuação, base de clientes) confirmados por pesquisa pública em agosto de 2026 — reconferir periodicamente, pois evoluem.',
  },
  {
    nome: 'Vidroscar',
    fee: 2000, dia: 25, forma: 'pix', pagador: 'VIDROSCAR',
    cor: '#06b6d4',
    area: 'regiao',
    cadencia: { [TER]: ['Vídeo'], [QUA]: ['Post'], [SEX]: ['Foto'] },
    briefing:
      'Para-brisas, vidros automotivos, insulfilm e higienização e manutenção de ar-condicionado automotivo. Endereço confirmado: Via Sérgio Braga, 520, Ponte Alta, Volta Redonda/RJ. Atende veículos nacionais e importados, de carro de passeio a caminhão e micro-ônibus. Visual moderno e técnico: azul escuro, azul claro e ciano, laranja pontual, carros valorizados e estética limpa, sem aparência artificial. O conteúdo parte de problemas reais do motorista: vidro trincado ou quebrado, segurança, insulfilm, ar-condicionado. Objetivo principal é gerar contato.',
    nota: 'Endereço e escopo de atendimento confirmados por pesquisa pública (RioSulVeiculos) em agosto de 2026.',
  },
  {
    nome: 'Rede de Postos Margarida',
    fee: 900, dia: 5, forma: 'nf', pagador: 'POSTO MARGARIDA',
    cor: '#16a34a',
    area: 'regiao',
    cadencia: { [SEG]: ['Post'], [QUA]: ['Vídeo'], [SEX]: ['Post'] },
    briefing:
      'Rede Auto Posto Margarida. Comunicação popular, próxima, voltada ao motorista e à família. Verde vibrante, amarelo e branco, com vermelho nos preços; campanhas específicas podem ganhar um tratamento mais premium. Destaques: qualidade dos combustíveis, economia, confiança, estrada e o diferencial do Diesel S10 aditivado.',
    nota: 'Segunda é o post da Terça da Sorte, a promoção da rede. Antes de produzir, perguntar ao cliente o valor da semana. Quarta e sexta alternam vídeo e post. Instagram oficial: @redepostomargarida — nome completo (Rede Auto Posto Margarida) confirmado por pesquisa pública em agosto de 2026; sem detalhe adicional verificável além disso.',
  },
  {
    nome: 'Carpintaria Meirelles',
    fee: 1000, dia: 5, forma: 'pix', pagador: 'PEDRO E CLARA (cobrar com Carlos)',
    cor: '#0f766e',
    area: 'regiao',
    cadencia: { [TER]: ['Vídeo'], [QUI]: ['Post'] },
    briefing:
      'Carpintaria e marcenaria, principalmente portas, janelas e projetos sob medida. Fundada em 1959 por João Meirelles em Santa Rita de Jacutinga, com operação em Barra Mansa desde 1969 — mais de 65 anos de tradição no ramo. Hoje sob administração de Carlos Henrique Meirelles. Endereço: Avenida Domingos Mariano, 428, Centro, Barra Mansa/RJ, com atendimento de segunda a sábado, das 8h às 18h30. Identidade sofisticada e artesanal: verde escuro e petróleo, verde turquesa, branco e tons naturais de madeira. A comunicação valoriza acabamento, qualidade, tradição, trabalho bem-feito, personalização e o cuidado de cada projeto — a história de mais de sessenta anos da família Meirelles é um argumento de peso a explorar.',
    nota: 'Fundação, endereço e horário confirmados por pesquisa pública em agosto de 2026.',
  },
  {
    nome: 'Barra Escap Autocenter',
    fee: 1200, dia: 25, forma: 'boleto', pagador: 'ACESSORIOS DE VEICULOS',
    cor: '#eab308',
    area: 'cidade',
    cadencia: { [TER]: ['Vídeo'], [QUA]: ['Post'], [SEX]: ['Post'] },
    briefing:
      'Centro automotivo: pneus novos e remoldados, alinhamento, balanceamento, suspensão, escapamento, óleo, manutenção preventiva, engate para reboque, protetor de cárter e inspeção de fumaça (emissão). Endereço: Rua José Marcelino de Camargo, 675, Centro, Barra Mansa/RJ. Alto impacto em preto e grafite, amarelo e dourado, branco, com referências a asfalto, pneu, metal e oficina. O conteúdo mistura oferta agressiva, diagnóstico de problema, educação automotiva e chamada direta para levar o veículo à oficina.',
    nota: 'Endereço e lista de serviços confirmados por pesquisa pública em agosto de 2026.',
  },
  {
    nome: 'Start Car',
    fee: 2000, dia: 10, forma: 'pix', pagador: 'AUTOMOTIVE',
    cor: '#1e40af',
    area: 'regiao',
    cadencia: { [TER]: ['Vídeo'], [QUA]: ['Post'], [SEX]: ['Post'] },
    briefing:
      'Loja multimarcas de veículos, comunicação jovem, comercial e orientada à venda. Azul escuro, branco e amarelo, com mascote presente e grande destaque para os veículos e as condições comerciais. Campanhas de oferta, aniversário da loja, oportunidades especiais, datas comemorativas e argumentos para acelerar a decisão de compra.',
    nota: 'Instagram oficial: @startcar.bm. Só postamos conteúdo gravado (fotos/vídeos que a própria loja manda) e posts de carros específicos que o cliente pede — não é produção de pauta própria da agência, é sob demanda. Os dois posts da semana são de veículos, usando os carros que o cliente manda no grupo.',
  },
  {
    nome: 'RPM Veículos',
    fee: 1500, dia: 25, forma: 'pix', pagador: 'RPS MOTA',
    cor: '#3b82f6',
    area: 'regiao',
    cadencia: { [TER]: ['Vídeo'], [QUA]: ['Post'], [SEX]: ['Post'] },
    briefing:
      'Loja de veículos multimarcas no Centro de Barra Mansa/RJ, em operação desde 2016, formalmente C R Mota Automóveis Ltda. Atendimento personalizado em duas lojas no Centro da cidade, com veículos revisados e higienizados, aprovação de financiamento pelo WhatsApp, parcelamento em até 60x sem entrada ou no cartão em até 12x. Segmento automotivo, vendas e campanhas com carros e motos. Azul royal, branco e ciano, veículos em cenário urbano ou rodoviário, comunicação dinâmica. Além do comercial, produzimos campanhas internas de metas, premiações, vouchers e peças comemorativas.',
    nota: 'Só postamos os veículos específicos que o cliente manda no grupo — sem pauta própria da agência, é sob demanda (mesma lógica da Start Car e da BT Veículos). Histórico e condições de financiamento confirmados por pesquisa pública em agosto de 2026.',
  },
  {
    nome: 'Connecta Telesaúde Digital',
    fee: 1500, dia: 20, forma: 'pix', pagador: 'PAULO KIYOSHI UEKANE',
    cor: '#14b8a6',
    area: 'nacional',
    cadencia: { [TER]: ['Vídeo'], [QUA]: ['Post'], [SEX]: ['Post'] },
    briefing:
      'Telemedicina com consultas online (connectatelesaude.com.br), proposta de tornar o atendimento médico acessível e prático. Consultas com médicos de diversas especialidades direto do celular ou computador, sistema próprio hospedado no Brasil e adequado à LGPD, atendimento 24h por dia e descontos exclusivos em farmácias e exames — implantação para empresas em 30 dias, sem investimento em infraestrutura. Identidade clara e moderna: branco, azul e turquesa, verde-limão e azul escuro, com médicos, pacientes e celulares. A comunicação destaca atendimento online, praticidade, preço acessível, disponibilidade 24h e os benefícios dos planos individuais e empresariais.',
    nota: 'Site e diferenciais (LGPD, implantação em 30 dias) confirmados por pesquisa pública em agosto de 2026.',
  },
  {
    nome: 'AH-I Entertainment',
    fee: 1000, dia: 30, forma: 'pix', pagador: 'JEFERSON MIATO',
    cor: '#22d3ee',
    area: 'regiao',
    cadencia: { [TER]: ['Vídeo'], [QUA]: ['Post'], [SEX]: ['Post'] },
    briefing:
      'Provedor de internet com posicionamento jovem e tecnológico, ligado a games, streaming, conectividade e vida digital. Estética tech e gamer: base escura, ciano, azul, amarelo e toques neon, com as peças sempre iluminadas e modernas. Pautas: estabilidade, velocidade, Wi-Fi, vários dispositivos ao mesmo tempo, situações do dia a dia e motivos para trocar de provedor.',
    nota: 'Instagram oficial: @provedor.ahi (perfil "AH-I | Provedor"). Pesquisa pública em agosto de 2026 não trouxe detalhe adicional verificável (endereço, área de cobertura, planos) — manter esse briefing como está até o cliente confirmar mais dados.',
  },
  {
    nome: 'Nascimento & Nascimento Advogados',
    fee: 2000, dia: 20, forma: 'pix', pagador: 'NASCIMENTO',
    cor: '#155e75',
    area: 'estado',
    cadencia: { [TER]: ['Vídeo'], [QUA]: ['Post'], [SEX]: ['Post'] },
    briefing:
      'Escritório jurídico tradicional, cerca de 40 anos de atuação, forte em direito previdenciário e causas de servidores. Identidade premium e institucional: azul-petróleo escuro, branco e detalhes dourados e bege. Pautas: INSS, aposentadoria, professores, piso do magistério, paridade, imposto de renda, benefícios negados e direitos pouco conhecidos.',
    nota: 'Instagram oficial: @nascimentoadvogadosbr. Pesquisa pública em agosto de 2026 encontrou vários outros escritórios "Nascimento Advogados" em outras cidades/estados (não confundir), mas não achou detalhe público adicional específico sobre esse escritório além do que já vinha do operacional — manter esse briefing (já detalhado) como está.',
  },
  {
    nome: 'Sterna Café Barra Mansa',
    cor: '#7c2d12',
    area: 'cidade',
    cidades: ['Barra Mansa'],
    fee: 2000, dia: 25, forma: 'pix', pagador: 'PENA & MENEGHITTI',
    cadencia: { [TER]: ['Vídeo'], [QUA]: ['Post'], [SEX]: ['Post'] },
    briefing:
      'Unidade local da rede Sterna Café (mais de 50 lojas no país, majoritariamente em SP) — a primeira unidade do interior do Rio de Janeiro, inaugurada no bairro Ano Bom, em Barra Mansa. Endereço: Rua Abdo Felipe, 126, Ano Bom, Barra Mansa/RJ, aberto de segunda a sábado, das 9h às 20h. Dirigida por Ana Beatriz Meneghitti Reis. Especializada em café especial brasileiro, com seis métodos de extração (Aeropress, Chemex, Clever, prensa francesa, Hario V60 e Koar). Cardápio variado: cafés quentes e gelados, brunch com pratos temáticos de país (Paris, Japão, Itália, Brasil), massas, refeições, saladas, sanduíches, salgados e sobremesas. Identidade da marca remete à ave sterna, a que mais viaja no mundo — conceito de experiência, cada xícara como uma descoberta. Comunicação deve valorizar o preparo, os métodos de extração, o ambiente e o produto com foto real.',
    nota: 'Fee, vencimento e forma de pagamento vieram do controle financeiro; briefing, identidade, endereço e horário vieram de pesquisa pública (site e Instagram da marca, matérias locais), atualizada em agosto de 2026. Cadência ainda não foi confirmada pelo cliente.',
  },
  {
    nome: 'Rua de Carros',
    cor: '#65a30d',
    area: 'regiao',
    cadencia: { [TER]: ['Vídeo'], [SEX]: ['Post'] },
    briefing:
      'Loja multimarcas de veículos, comunicação comercial e orientada à venda. O conteúdo mistura oferta agressiva, condições comerciais e destaque para os veículos.',
    nota: 'Instagram oficial: @ruadecarrosbm. Conteúdo é 100% por demanda: só sai o que o cliente manda no grupo, sem pauta própria da agência. Fee, dia de vencimento e forma de pagamento ainda não foram informados.',
  },
  {
    nome: 'Grupo 3D Empreendimentos',
    cor: '#475569',
    area: 'regiao',
    cadencia: { [TER]: ['Vídeo'], [QUA]: ['Post'], [SEX]: ['Post'] },
    briefing:
      'Grupo imobiliário com atuação integrada em gestão, locação, engenharia, design, reformas e valorização de patrimônio. Identidade premium, clean e sofisticada: azul-petróleo, grafite, slate, cinza e branco, com pouca poluição visual. A comunicação transmite autoridade e segurança para proprietários e investidores, e busca captar imóveis para gestão e locação.',
    nota: 'Instagram oficial: @grupo3dempreendimentos. Pesquisa pública em agosto de 2026 não achou detalhe adicional (o perfil não veio indexado) — manter esse briefing (já detalhado a partir do operacional real) como está.',
  },
  {
    nome: 'Concreblocos & Lajes',
    fee: 750, dia: 25, forma: 'boleto', pagador: 'CONCREBLOCOS',
    cor: '#f97316',
    area: 'regiao',
    cidades: SUL_FLUMINENSE,
    cadencia: { [TER]: ['Vídeo'], [QUI]: ['Post'] },
    briefing:
      'Construção civil: lajes, pré-moldados e soluções estruturais para obra. Sede em Barra Mansa/RJ (confirmado). Azul royal, amarelo e laranja, branco, com prioridade para foto real, headline forte e linguagem profissional acessível. O conteúdo mistura obras realizadas, bastidores, orientação técnica, logística, autoridade e campanhas comerciais regionais.',
    nota: 'Instagram oficial: @concreblocoselajes. Localização em Barra Mansa/RJ confirmada por pesquisa pública (página no Facebook) em agosto de 2026; endereço exato e ano de fundação não encontrados — manter o resto do briefing como está.',
  },
  {
    nome: 'Dra. Elba Ferrão',
    fee: 1500, dia: 16, forma: 'pix', pagador: 'ELBA CHRISTINA',
    cor: '#f472b6',
    area: 'cidade',
    cadencia: { [TER]: ['Vídeo'], [QUA]: ['Post'], [SEX]: ['Foto'] },
    briefing:
      'Médica oftalmologista, Clínica de Olhos Dra. Elba Ferrão. Endereço: Avenida Joaquim Leite, 396, Centro, Barra Mansa/RJ. Comunicação educativa, elegante, baseada em prevenção e cuidado com a visão. Identidade delicada e premium: branco, bege, rosé e coral, com imagens humanas ou elementos ligados aos olhos e à visão. Pautas: sintomas, curiosidades, novas tecnologias da oftalmologia, prevenção, exames e assuntos que despertam curiosidade.',
    nota: 'Endereço confirmado por pesquisa pública em agosto de 2026.',
  },
  {
    nome: 'Dra. Lara',
    fee: 700, dia: 30, forma: 'pix', pagador: 'LARA',
    cor: '#a8a29e',
    area: 'cidade',
    cadencia: { [TER]: ['Vídeo'], [QUA]: ['Post'], [SEX]: ['Post'] },
    briefing:
      'Dra. Lara Oliveira, odontologia com posicionamento em atendimento humano, acolhimento e confiança. Visual minimalista, elegante e profissional, com prioridade para fotos reais da própria profissional e layouts com bastante respiro. A comunicação aproxima paciente e dentista: cuidado, escuta, segurança e experiência no atendimento.',
    nota: 'Instagram oficial: @dralaraoliveira_ — sobrenome (Oliveira) confirmado pelo próprio perfil em agosto de 2026; endereço da clínica não encontrado publicamente.',
  },
  {
    nome: 'Sicomércio Barra Mansa',
    fee: 2733.69, dia: 13, forma: 'boleto', pagador: 'SICOMERCIO',
    cor: '#1d4ed8',
    area: 'cidade',
    cidades: ['Barra Mansa'],
    cadencia: { [TER]: ['Vídeo'], [QUA]: ['Post'], [SEX]: ['Post'] },
    briefing:
      'Sindicato do Comércio Varejista de Barra Mansa, Porto Real, Quatis e Rio Claro. Sede: Rua José Maria da Cruz, 55, Sala 204, Centro, Barra Mansa/RJ. Entidade representativa do comércio da região, comunicação institucional voltada aos comerciantes e à valorização da economia local, com atuação em convenções coletivas e pauta salarial da categoria (piso do comércio). Linha profissional e institucional, que pode ganhar tom mais comercial em campanhas promocionais. Trabalhamos datas comemorativas, ações promocionais sazonais (tipo Natal Premiado, Show de Prêmios das Mães) e mensagens incentivando o consumidor a prestigiar o comércio da cidade.',
    nota: 'Endereço, abrangência regional (4 municípios) e exemplos de campanha confirmados por pesquisa pública em agosto de 2026.',
  },
  {
    nome: 'BT Veículos',
    fee: 1000, dia: 20, forma: 'pix', pagador: 'BALCAO DE NEGOCIOS',
    cor: '#dc2626',
    area: 'cidade',
    cidades: ['Jundiaí'],
    cadencia: { [TER]: ['Vídeo'], [QUA]: ['Post'], [SEX]: ['Post'] },
    briefing:
      'Loja de veículos em Jundiaí/SP (fora do Sul Fluminense, atenção pra não confundir com os outros clientes automotivos da região). Campanhas comerciais ligadas a feirões e condições especiais de financiamento. Visual automotivo, forte e promocional, com os carros em destaque, chamada objetiva e benefício claro. Campanhas já feitas: desconto no pátio, transferência, tanque cheio, datas especiais e ações em parceria com financiamento.',
    nota: 'Instagram oficial: @bt_veiculos_jundiai — confirma cidade (Jundiaí/SP) em agosto de 2026; corrigido em relação ao registro anterior, que não tinha cidade definida. Só postamos os veículos específicos que o cliente manda no grupo, sem pauta própria (mesma lógica da Start Car e da RPM).',
  },
  {
    nome: 'Kbral Park',
    fee: 1500, dia: 20, forma: 'pix', pagador: 'RJS RESTAURANTE LTDA',
    cor: '#d946ef',
    area: 'regiao',
    cadencia: { [TER]: ['Vídeo'], [QUA]: ['Foto'], [SEX]: ['Foto'] },
    briefing:
      'Buffet infantil para festas, único no formato buffet completo para eventos infantis da região. Endereço: Rua Gustavo Lira, 273, São João, Volta Redonda/RJ. Espaço centralizado e seguro, pensado para festas de aniversário e eventos em família. Entretenimento infantil e familiar: experiências, festas, brinquedos, crianças e alimentação. A comunicação precisa transmitir diversão de forma real, mostrando crianças usando o espaço e famílias aproveitando o ambiente. A produção prioriza criança brincando, comida pronta, momento em família e cena espontânea que mostre a experiência. Conferir os perfis no Instagram antes de cada planejamento, para acompanhar atrações e novidades da temporada.',
    nota: 'As duas entregas semanais são fotos, não artes. Endereço e posicionamento (único buffet do formato na região) confirmados por pesquisa pública em agosto de 2026.',
  },
  {
    nome: 'Kbral Kids',
    cor: '#f0abfc',
    area: 'regiao',
    fee: 1000, dia: 5, forma: 'pix', pagador: 'SUKIO HIGO',
    cadencia: {},
    briefing:
      'Restaurante infantil da mesma família do Kbral Park, faturado separado. Endereço: Rua João Valiante, 89, Ano Bom, Barra Mansa/RJ. Cardápio com pizzas e hambúrgueres artesanais, ambiente pensado para famílias com monitoria, recreação infantil, pintura facial, piscina de bolinhas, escorregador, cesta de basquete, videogames e vila kids, além de motinhas elétricas. A comunicação mostra crianças usando o espaço e famílias aproveitando o ambiente, com cenas espontâneas e comida pronta. Conferir o Instagram antes de cada planejamento, para acompanhar atrações e novidades da temporada.',
    nota: 'Entrega combinada junto com o Kbral Park. Endereço e estrutura do espaço confirmados por pesquisa pública em agosto de 2026.',
  },
  {
    nome: 'Mastermax Contabilidade',
    fee: 1500, dia: 30, forma: 'boleto', pagador: 'MASTERMAX CONTABILIDADE',
    cor: '#0284c7',
    area: 'regiao',
    cadencia: { [TER]: ['Vídeo'], [QUA]: ['Post'], [SEX]: ['Post'] },
    briefing:
      'Escritório de contabilidade em atuação desde 2008, com equipe de médio porte (entre 51 e 200 colaboradores) e atendimento em modelo de procedimentos automatizados. Endereço: Rua Prefeito Mário Pinto dos Reis, 51, Barra Mansa/RJ. Além da contabilidade tradicional, oferece consultoria e estruturação de holding familiar para proteção patrimonial e planejamento sucessório. Comunicação educativa e estratégica para empresas, empreendedores, MEIs e pessoas com CNPJ. Visual profissional e corporativo. O conteúdo precisa simplificar assunto complexo sem perder autoridade. Pautas: CNPJ, MEI, tributação, Reforma Tributária, erros fiscais, suspensão de empresas, holding familiar e decisões importantes para o empresário.',
    nota: 'Endereço, porte e serviço de holding familiar confirmados por pesquisa pública em agosto de 2026.',
  },
  {
    nome: 'Mega Móveis',
    cor: '#9333ea',
    area: 'regiao',
    cidades: ['Volta Redonda', 'Barra Mansa'],
    cadencia: {},
    briefing:
      'Lojas Mega Móveis, duas unidades: Av. Paulo de Frontin, 323, Aterrado, Volta Redonda/RJ, e Av. Domingos Mariano, 102, Centro, Barra Mansa/RJ. Loja de móveis com posicionamento muito comercial e popular, baseado em oferta, condição de pagamento e grandes campanhas promocionais. A identidade das ofertas usa roxo, magenta, laranja e amarelo, com produto grande e hierarquia forte para preço e parcelamento. Campanhas como Aniversário da Patroa, ofertas especiais, datas comemorativas e peças diretas para venda imediata.',
    nota: 'Sem cadência fixa. As demandas chegam pelo grupo e entram como avulsas, então este cliente fica de fora do planejamento automático. Instagram oficial: @lojasmega.moveis — as duas lojas (Volta Redonda e Barra Mansa) confirmadas por pesquisa pública em agosto de 2026.',
  },
  {
    nome: 'Barra Travel',
    fee: 2000, dia: 10, forma: 'pix', pagador: 'BARRA TRAVEL',
    cor: '#0891b2',
    area: 'cidade',
    cidades: ['Rio de Janeiro'],
    cadencia: { [TER]: ['Vídeo'], [QUI]: ['Post'] },
    briefing:
      '"Barra Travel leva você" — agência de viagens desde 2008, fundada por Melissa Lopes, sediada na Barra da Tijuca, Rio de Janeiro/RJ (Av. das Américas, 700) — não é a cidade de Barra Mansa, apesar do nome parecido, atenção pra não confundir. Pacotes nacionais e internacionais, hospedagem, passagem e experiências, com infraestrutura, equipe e tecnologia como diferenciais. A comunicação valoriza visualmente o destino, mantendo aparência profissional e aspiracional, com a informação comercial bem organizada. Produzimos divulgação de pacotes completos, condições de parcelamento, campanhas sazonais e destinos como Chile e Nova York.',
    nota: 'Instagram oficial: @barratravel, site barratravel.com.br — fundação, fundadora e endereço confirmados por pesquisa pública em agosto de 2026 (corrigido: cidade é Rio de Janeiro/Barra da Tijuca, não Barra Mansa). A gente sempre pega o material que eles mandam pra fazer os posts e vídeos — não é produção autoral do zero.',
  },
  {
    nome: 'Camisaria Pinguim',
    fee: 1000, dia: 5, forma: 'pix', pagador: 'CAMISARIA PINGUIM',
    cor: '#334155',
    area: 'cidade',
    cadencia: { [TER]: ['Vídeo'], [QUI]: ['Foto'] },
    briefing:
      'Camisaria masculina em operação desde 1970 — mais de 50 anos de história no Centro de Barra Mansa. Endereço: Avenida Joaquim Leite, Centro, Barra Mansa/RJ. Mix que inclui moda, ternos, carteiras, garrafas, bolsas, mochilas, malas, nécessaires e pastas. Comunicação comercial: valorizar produto, variedade, preço e oportunidade de compra sem sobrecarregar o layout — a tradição de décadas na cidade é um argumento de confiança a explorar. Conteúdos de vídeo de produto, campanhas de moda e ofertas, como ternos a partir de R$ 495.',
    nota: 'A entrega semanal costuma ser foto, não arte. Fundação (1970) e endereço confirmados por pesquisa pública em agosto de 2026.',
  },
];

export function seedData(): WorkspaceData {
  const clients: Client[] = CARTEIRA.map((c) => ({
    id: uid('cli'),
    name: c.nome,
    color: c.cor,
    briefing: c.briefing + (c.nota ? `\n\nCombinado de operação: ${c.nota}` : ''),
    weeklyPlan: c.cadencia,
    serviceArea: c.area,
    // Só entra cidade onde há certeza. As demais ficam em branco de propósito:
    // chutar a praça erra o aniversário da cidade no planejamento, e a tela de
    // Clientes mostra quem ainda está sem preencher.
    cities: c.cidades,
    monthlyFee: c.fee,
    billingDay: c.dia,
    billingMethod: c.forma,
    contact: c.pagador,
    createdAt: Date.now(),
  }));

  // Cada agente Omni fatura sozinho e tem a própria praça. O conteúdo não é
  // duplicado: sai uma vez em "Banco Omni" e serve para todos.
  for (const [nome, cidade, fee, dia, forma, pagador] of AGENTES_OMNI) {
    clients.push({
      id: uid('cli'),
      name: nome,
      color: '#2563eb',
      briefing:
        `Agente Omni em ${cidade}, correspondente bancário do Banco Omni. ` +
        'O conteúdo da semana vem pronto de "Banco Omni" e serve para todos os agentes. ' +
        'Só feirão e ação local desta praça pedem peça exclusiva, e aí entram com a cidade no material.',
      cities: [cidade],
      serviceArea: 'cidade',
      weeklyPlan: {},
      monthlyFee: fee,
      billingDay: dia,
      billingMethod: forma ?? 'pix',
      contact: pagador,
      createdAt: Date.now(),
    });
  }

  const board: Board = {
    id: uid('board'),
    name: 'Produção de Conteúdo',
    description: 'Fluxo geral de demandas criativas da agência.',
    columns: [
      { id: uid('col'), title: 'A fazer', cardIds: [] },
      { id: uid('col'), title: 'Em produção', cardIds: [] },
      { id: uid('col'), title: 'Revisão', cardIds: [] },
      { id: uid('col'), title: 'Prontos', cardIds: [] },
      { id: uid('col'), title: 'Concluído', cardIds: [] },
    ],
    cards: {},
    createdAt: Date.now(),
  };

  return {
    clients,
    boards: [board],
    transactions: [],
    posts: [],
    videos: [],
    library: [],
    events: [],
    charges: [],
    campaigns: [],
  };
}


/**
 * Snapshots do briefing (texto + observação de operação) de cada cliente
 * em rodadas anteriores de pesquisa pública (agosto de 2026: rodada 1 —
 * primeira pesquisa geral; rodada 2 — pesquisa a partir dos Instagrams
 * oficiais enviados pelo cliente). Serve só pra `restoreBriefings`
 * (dataStore) saber quando o briefing salvo de alguém ainda é uma versão
 * antiga "de fábrica" — aí pode trocar com segurança pelo texto mais
 * recente, sem nunca sobrescrever um briefing que a equipe já editou na
 * tela.
 */
export const OLD_BRIEFINGS: Record<string, string[]> = {
  'Banco Omni': ['Financeira focada em financiamento e refinanciamento de carros, motos e caminhões, com mais de 30 anos e presença em mais de 100 cidades. Trabalha por uma rede de Agentes Omni, correspondentes bancários espalhados pelo Brasil: o mesmo conteúdo serve para todos os agentes, e só feirões e ações locais pedem peça exclusiva. Comunicação popular, comercial e voltada à conversão. Azul royal, branco e laranja, com veículos, pessoas reais, movimento e headlines curtas de grande impacto. Pautas recorrentes: feirões, ações em loja, refinanciamento, Plano Renova, campanhas sazonais e material para correspondentes e lojistas.\n\nCombinado de operação: Conteúdo único para todos os agentes. Os agentes ficam em praças diferentes, inclusive em outros estados, então feirão e ação local entram como peça extra com a cidade daquele agente.', 'Financeira focada em financiamento e refinanciamento de carros, motos e caminhões. No mercado desde 1994 (27 anos de atuação), com mais de 4,7 milhões de clientes atendidos e rede de mais de 100 correspondentes exclusivos (Agentes Omni) espalhados por 13 estados do Brasil. Faz parte do Conglomerado Prudencial Omni, autorizado pelo Banco Central. Trabalha por uma rede de Agentes Omni, correspondentes bancários espalhados pelo Brasil: o mesmo conteúdo serve para todos os agentes, e só feirões e ações locais pedem peça exclusiva. Comunicação popular, comercial e voltada à conversão. Azul royal, branco e laranja, com veículos, pessoas reais, movimento e headlines curtas de grande impacto. Pautas recorrentes: feirões, ações em loja, refinanciamento, Plano Renova, campanhas sazonais e material para correspondentes e lojistas.\n\nCombinado de operação: Conteúdo único para todos os agentes. Os agentes ficam em praças diferentes, inclusive em outros estados, então feirão e ação local entram como peça extra com a cidade daquele agente. Números de mercado (anos de atuação, base de clientes) confirmados por pesquisa pública em agosto de 2026 — reconferir periodicamente, pois evoluem.'],
  'Vidroscar': ['Para-brisas, vidros automotivos, insulfilm e higienização e manutenção de ar-condicionado automotivo. Visual moderno e técnico: azul escuro, azul claro e ciano, laranja pontual, carros valorizados e estética limpa, sem aparência artificial. O conteúdo parte de problemas reais do motorista: vidro trincado ou quebrado, segurança, insulfilm, ar-condicionado. Objetivo principal é gerar contato.', 'Para-brisas, vidros automotivos, insulfilm e higienização e manutenção de ar-condicionado automotivo. Endereço confirmado: Via Sérgio Braga, 520, Ponte Alta, Volta Redonda/RJ. Atende veículos nacionais e importados, de carro de passeio a caminhão e micro-ônibus. Visual moderno e técnico: azul escuro, azul claro e ciano, laranja pontual, carros valorizados e estética limpa, sem aparência artificial. O conteúdo parte de problemas reais do motorista: vidro trincado ou quebrado, segurança, insulfilm, ar-condicionado. Objetivo principal é gerar contato.\n\nCombinado de operação: Endereço e escopo de atendimento confirmados por pesquisa pública (RioSulVeiculos) em agosto de 2026.'],
  'Rede de Postos Margarida': ['Rede de postos de combustíveis com comunicação popular, próxima, voltada ao motorista e à família. Verde vibrante, amarelo e branco, com vermelho nos preços; campanhas específicas podem ganhar um tratamento mais premium. Destaques: qualidade dos combustíveis, economia, confiança, estrada e o diferencial do Diesel S10 aditivado.\n\nCombinado de operação: Segunda é o post da Terça da Sorte, a promoção da rede. Antes de produzir, perguntar ao cliente o valor da semana. Quarta e sexta alternam vídeo e post.', 'Rede de postos de combustíveis com comunicação popular, próxima, voltada ao motorista e à família. Verde vibrante, amarelo e branco, com vermelho nos preços; campanhas específicas podem ganhar um tratamento mais premium. Destaques: qualidade dos combustíveis, economia, confiança, estrada e o diferencial do Diesel S10 aditivado.\n\nCombinado de operação: Segunda é o post da Terça da Sorte, a promoção da rede. Antes de produzir, perguntar ao cliente o valor da semana. Quarta e sexta alternam vídeo e post. Pesquisa pública em agosto de 2026 só confirmou o perfil no Instagram (@redepostomargarida); sem detalhe adicional verificável — manter esse briefing como está até o cliente confirmar mais dados.'],
  'Carpintaria Meirelles': ['Carpintaria e marcenaria, principalmente portas, janelas e projetos sob medida. Identidade sofisticada e artesanal: verde escuro e petróleo, verde turquesa, branco e tons naturais de madeira. A comunicação valoriza acabamento, qualidade, tradição, trabalho bem-feito, personalização e o cuidado de cada projeto.', 'Carpintaria e marcenaria, principalmente portas, janelas e projetos sob medida. Fundada em 1959 por João Meirelles em Santa Rita de Jacutinga, com operação em Barra Mansa desde 1969 — mais de 65 anos de tradição no ramo. Hoje sob administração de Carlos Henrique Meirelles. Endereço: Avenida Domingos Mariano, 428, Centro, Barra Mansa/RJ, com atendimento de segunda a sábado, das 8h às 18h30. Identidade sofisticada e artesanal: verde escuro e petróleo, verde turquesa, branco e tons naturais de madeira. A comunicação valoriza acabamento, qualidade, tradição, trabalho bem-feito, personalização e o cuidado de cada projeto — a história de mais de sessenta anos da família Meirelles é um argumento de peso a explorar.\n\nCombinado de operação: Fundação, endereço e horário confirmados por pesquisa pública em agosto de 2026.'],
  'Barra Escap Autocenter': ['Centro automotivo: escapamento, pneus, óleo, alinhamento, balanceamento, suspensão, freios e manutenção preventiva. Alto impacto em preto e grafite, amarelo e dourado, branco, com referências a asfalto, pneu, metal e oficina. O conteúdo mistura oferta agressiva, diagnóstico de problema, educação automotiva e chamada direta para levar o veículo à oficina.', 'Centro automotivo: pneus novos e remoldados, alinhamento, balanceamento, suspensão, escapamento, óleo, manutenção preventiva, engate para reboque, protetor de cárter e inspeção de fumaça (emissão). Endereço: Rua José Marcelino de Camargo, 675, Centro, Barra Mansa/RJ. Alto impacto em preto e grafite, amarelo e dourado, branco, com referências a asfalto, pneu, metal e oficina. O conteúdo mistura oferta agressiva, diagnóstico de problema, educação automotiva e chamada direta para levar o veículo à oficina.\n\nCombinado de operação: Endereço e lista de serviços confirmados por pesquisa pública em agosto de 2026.'],
  'Start Car': ['Loja multimarcas de veículos, comunicação jovem, comercial e orientada à venda. Azul escuro, branco e amarelo, com mascote presente e grande destaque para os veículos e as condições comerciais. Campanhas de oferta, aniversário da loja, oportunidades especiais, datas comemorativas e argumentos para acelerar a decisão de compra.\n\nCombinado de operação: Os dois posts da semana são de veículos, usando os carros que o cliente manda no grupo.', 'Loja multimarcas de veículos, comunicação jovem, comercial e orientada à venda. Azul escuro, branco e amarelo, com mascote presente e grande destaque para os veículos e as condições comerciais. Campanhas de oferta, aniversário da loja, oportunidades especiais, datas comemorativas e argumentos para acelerar a decisão de compra.\n\nCombinado de operação: Os dois posts da semana são de veículos, usando os carros que o cliente manda no grupo. Pesquisa pública em agosto de 2026 não encontrou uma loja "Start Car" confirmada em Barra Mansa/Volta Redonda (há outras "Start Car" de mesmo nome em outras cidades, não confundir) — manter esse briefing como está até confirmar com o cliente.'],
  'RPM Veículos': ['Segmento automotivo, vendas e campanhas com carros e motos. Azul royal, branco e ciano, veículos em cenário urbano ou rodoviário, comunicação dinâmica. Além do comercial, produzimos campanhas internas de metas, premiações, vouchers e peças comemorativas.\n\nCombinado de operação: Os dois posts da semana são de veículos, usando os carros que o cliente manda no grupo.', 'Loja de veículos multimarcas no Centro de Barra Mansa/RJ, em operação desde 2016, formalmente C R Mota Automóveis Ltda. Atendimento personalizado em duas lojas no Centro da cidade, com veículos revisados e higienizados, aprovação de financiamento pelo WhatsApp, parcelamento em até 60x sem entrada ou no cartão em até 12x. Segmento automotivo, vendas e campanhas com carros e motos. Azul royal, branco e ciano, veículos em cenário urbano ou rodoviário, comunicação dinâmica. Além do comercial, produzimos campanhas internas de metas, premiações, vouchers e peças comemorativas.\n\nCombinado de operação: Os dois posts da semana são de veículos, usando os carros que o cliente manda no grupo. Histórico e condições de financiamento confirmados por pesquisa pública em agosto de 2026.'],
  'Connecta Telesaúde Digital': ['Telemedicina com consultas online, proposta de tornar o atendimento médico acessível e prático. Identidade clara e moderna: branco, azul e turquesa, verde-limão e azul escuro, com médicos, pacientes e celulares. A comunicação destaca atendimento online, praticidade, preço acessível, disponibilidade 24h e os benefícios dos planos individuais e empresariais.', 'Telemedicina com consultas online (connectatelesaude.com.br), proposta de tornar o atendimento médico acessível e prático. Consultas com médicos de diversas especialidades direto do celular ou computador, sistema próprio hospedado no Brasil e adequado à LGPD, atendimento 24h por dia e descontos exclusivos em farmácias e exames — implantação para empresas em 30 dias, sem investimento em infraestrutura. Identidade clara e moderna: branco, azul e turquesa, verde-limão e azul escuro, com médicos, pacientes e celulares. A comunicação destaca atendimento online, praticidade, preço acessível, disponibilidade 24h e os benefícios dos planos individuais e empresariais.\n\nCombinado de operação: Site e diferenciais (LGPD, implantação em 30 dias) confirmados por pesquisa pública em agosto de 2026.'],
  'AH-I Entertainment': ['Provedor de internet com posicionamento jovem e tecnológico, ligado a games, streaming, conectividade e vida digital. Estética tech e gamer: base escura, ciano, azul, amarelo e toques neon, com as peças sempre iluminadas e modernas. Pautas: estabilidade, velocidade, Wi-Fi, vários dispositivos ao mesmo tempo, situações do dia a dia e motivos para trocar de provedor.', 'Provedor de internet com posicionamento jovem e tecnológico, ligado a games, streaming, conectividade e vida digital. Estética tech e gamer: base escura, ciano, azul, amarelo e toques neon, com as peças sempre iluminadas e modernas. Pautas: estabilidade, velocidade, Wi-Fi, vários dispositivos ao mesmo tempo, situações do dia a dia e motivos para trocar de provedor.\n\nCombinado de operação: Pesquisa pública em agosto de 2026 confirmou só o perfil no Instagram (@provedor.ahi), sem detalhe adicional verificável (endereço, área de cobertura, planos) — manter esse briefing como está até o cliente confirmar mais dados.'],
  'Nascimento & Nascimento Advogados': ['Escritório jurídico tradicional, cerca de 40 anos de atuação, forte em direito previdenciário e causas de servidores. Identidade premium e institucional: azul-petróleo escuro, branco e detalhes dourados e bege. Pautas: INSS, aposentadoria, professores, piso do magistério, paridade, imposto de renda, benefícios negados e direitos pouco conhecidos.', 'Escritório jurídico tradicional, cerca de 40 anos de atuação, forte em direito previdenciário e causas de servidores. Identidade premium e institucional: azul-petróleo escuro, branco e detalhes dourados e bege. Pautas: INSS, aposentadoria, professores, piso do magistério, paridade, imposto de renda, benefícios negados e direitos pouco conhecidos.\n\nCombinado de operação: Pesquisa pública em agosto de 2026 encontrou vários escritórios "Nascimento Advogados" em outras cidades/estados (não confundir), mas não confirmou o escritório específico da carteira — manter esse briefing (já detalhado a partir do operacional real) como está até checagem com o cliente.'],
  'Sterna Café Barra Mansa': ['Unidade local da rede Sterna Café, franquia de cafeteria especializada em café especial brasileiro (grãos 100% especiais de várias regiões, métodos de extração internacionais). Cardápio variado: cafés quentes e gelados, massas, refeições, saladas, sanduíches, salgados e sobremesas. Identidade da marca remete à ave sterna, a que mais viaja no mundo — conceito de experiência, cada xícara como uma descoberta. Comunicação deve valorizar o preparo, o ambiente e o produto com foto real.\n\nCombinado de operação: Fee, vencimento e forma de pagamento vieram do controle financeiro; briefing e identidade vieram de pesquisa pública (site e Instagram da marca). Cadência ainda não foi confirmada pelo cliente.', 'Unidade local da rede Sterna Café (mais de 50 lojas no país, majoritariamente em SP) — a primeira unidade do interior do Rio de Janeiro, inaugurada no bairro Ano Bom, em Barra Mansa. Endereço: Rua Abdo Felipe, 126, Ano Bom, Barra Mansa/RJ, aberto de segunda a sábado, das 9h às 20h. Dirigida por Ana Beatriz Meneghitti Reis. Especializada em café especial brasileiro, com seis métodos de extração (Aeropress, Chemex, Clever, prensa francesa, Hario V60 e Koar). Cardápio variado: cafés quentes e gelados, brunch com pratos temáticos de país (Paris, Japão, Itália, Brasil), massas, refeições, saladas, sanduíches, salgados e sobremesas. Identidade da marca remete à ave sterna, a que mais viaja no mundo — conceito de experiência, cada xícara como uma descoberta. Comunicação deve valorizar o preparo, os métodos de extração, o ambiente e o produto com foto real.\n\nCombinado de operação: Fee, vencimento e forma de pagamento vieram do controle financeiro; briefing, identidade, endereço e horário vieram de pesquisa pública (site e Instagram da marca, matérias locais), atualizada em agosto de 2026. Cadência ainda não foi confirmada pelo cliente.'],
  'Rua de Carros': ['Loja multimarcas de veículos, comunicação comercial e orientada à venda. O conteúdo mistura oferta agressiva, condições comerciais e destaque para os veículos.\n\nCombinado de operação: Os posts são de veículos, usando os carros que o cliente manda no grupo. Fee, dia de vencimento e forma de pagamento ainda não foram informados.', 'Loja multimarcas de veículos, comunicação comercial e orientada à venda. O conteúdo mistura oferta agressiva, condições comerciais e destaque para os veículos.\n\nCombinado de operação: Os posts são de veículos, usando os carros que o cliente manda no grupo. Fee, dia de vencimento e forma de pagamento ainda não foram informados. Pesquisa pública em agosto de 2026 não confirmou uma loja "Rua de Carros" específica na região — manter esse briefing como está até confirmar com o cliente.'],
  'Grupo 3D Empreendimentos': ['Grupo imobiliário com atuação integrada em gestão, locação, engenharia, design, reformas e valorização de patrimônio. Identidade premium, clean e sofisticada: azul-petróleo, grafite, slate, cinza e branco, com pouca poluição visual. A comunicação transmite autoridade e segurança para proprietários e investidores, e busca captar imóveis para gestão e locação.', 'Grupo imobiliário com atuação integrada em gestão, locação, engenharia, design, reformas e valorização de patrimônio. Identidade premium, clean e sofisticada: azul-petróleo, grafite, slate, cinza e branco, com pouca poluição visual. A comunicação transmite autoridade e segurança para proprietários e investidores, e busca captar imóveis para gestão e locação.\n\nCombinado de operação: Pesquisa pública em agosto de 2026 não confirmou o "Grupo 3D Empreendimentos" especificamente em Barra Mansa — manter esse briefing (já detalhado a partir do operacional real) como está até checagem com o cliente.'],
  'Concreblocos & Lajes': ['Construção civil: lajes, pré-moldados e soluções estruturais para obra. Azul royal, amarelo e laranja, branco, com prioridade para foto real, headline forte e linguagem profissional acessível. O conteúdo mistura obras realizadas, bastidores, orientação técnica, logística, autoridade e campanhas comerciais regionais.', 'Construção civil: lajes, pré-moldados e soluções estruturais para obra. Azul royal, amarelo e laranja, branco, com prioridade para foto real, headline forte e linguagem profissional acessível. O conteúdo mistura obras realizadas, bastidores, orientação técnica, logística, autoridade e campanhas comerciais regionais.\n\nCombinado de operação: Pesquisa pública em agosto de 2026 não confirmou a "Concreblocos & Lajes" especificamente (há outros fabricantes de laje pré-moldada na região, não confundir) — manter esse briefing como está até checagem com o cliente.'],
  'Dra. Elba Ferrão': ['Médica oftalmologista, comunicação educativa, elegante, baseada em prevenção e cuidado com a visão. Identidade delicada e premium: branco, bege, rosé e coral, com imagens humanas ou elementos ligados aos olhos e à visão. Pautas: sintomas, curiosidades, novas tecnologias da oftalmologia, prevenção, exames e assuntos que despertam curiosidade.', 'Médica oftalmologista, Clínica de Olhos Dra. Elba Ferrão. Endereço: Avenida Joaquim Leite, 396, Centro, Barra Mansa/RJ. Comunicação educativa, elegante, baseada em prevenção e cuidado com a visão. Identidade delicada e premium: branco, bege, rosé e coral, com imagens humanas ou elementos ligados aos olhos e à visão. Pautas: sintomas, curiosidades, novas tecnologias da oftalmologia, prevenção, exames e assuntos que despertam curiosidade.\n\nCombinado de operação: Endereço confirmado por pesquisa pública em agosto de 2026.'],
  'Dra. Lara': ['Odontologia com posicionamento em atendimento humano, acolhimento e confiança. Visual minimalista, elegante e profissional, com prioridade para fotos reais da própria profissional e layouts com bastante respiro. A comunicação aproxima paciente e dentista: cuidado, escuta, segurança e experiência no atendimento.', 'Odontologia com posicionamento em atendimento humano, acolhimento e confiança. Visual minimalista, elegante e profissional, com prioridade para fotos reais da própria profissional e layouts com bastante respiro. A comunicação aproxima paciente e dentista: cuidado, escuta, segurança e experiência no atendimento.\n\nCombinado de operação: Pesquisa pública em agosto de 2026 não confirmou "Dra. Lara" com esse nome exato entre os dentistas listados na região (provavelmente forma curta/apelido usado internamente) — manter esse briefing como está até confirmar nome completo e endereço com o cliente.'],
  'Sicomércio Barra Mansa': ['Entidade representativa do comércio de Barra Mansa, comunicação institucional voltada aos comerciantes e à valorização da economia local. Linha profissional e institucional, que pode ganhar tom mais comercial em campanhas promocionais. Trabalhamos datas comemorativas, ações como Amor Premiado e mensagens incentivando o consumidor a prestigiar o comércio da cidade.', 'Sindicato do Comércio Varejista de Barra Mansa, Porto Real, Quatis e Rio Claro. Sede: Rua José Maria da Cruz, 55, Sala 204, Centro, Barra Mansa/RJ. Entidade representativa do comércio da região, comunicação institucional voltada aos comerciantes e à valorização da economia local, com atuação em convenções coletivas e pauta salarial da categoria (piso do comércio). Linha profissional e institucional, que pode ganhar tom mais comercial em campanhas promocionais. Trabalhamos datas comemorativas, ações promocionais sazonais (tipo Natal Premiado, Show de Prêmios das Mães) e mensagens incentivando o consumidor a prestigiar o comércio da cidade.\n\nCombinado de operação: Endereço, abrangência regional (4 municípios) e exemplos de campanha confirmados por pesquisa pública em agosto de 2026.'],
  'BT Veículos': ['Loja de veículos com campanhas comerciais ligadas a feirões e condições especiais de financiamento. Visual automotivo, forte e promocional, com os carros em destaque, chamada objetiva e benefício claro. Campanhas já feitas: desconto no pátio, transferência, tanque cheio, datas especiais e ações em parceria com financiamento.\n\nCombinado de operação: Os dois posts da semana são de veículos, usando os carros que o cliente manda no grupo.', 'Loja de veículos com campanhas comerciais ligadas a feirões e condições especiais de financiamento. Visual automotivo, forte e promocional, com os carros em destaque, chamada objetiva e benefício claro. Campanhas já feitas: desconto no pátio, transferência, tanque cheio, datas especiais e ações em parceria com financiamento.\n\nCombinado de operação: Os dois posts da semana são de veículos, usando os carros que o cliente manda no grupo. Pesquisa pública em agosto de 2026 não confirmou "BT Veículos" com esse nome exato (encontrado apenas negócios de nome parecido, como "B M Veículos", não confundir) — manter esse briefing como está até checagem com o cliente.'],
  'Kbral Park': ['Entretenimento infantil e familiar: experiências, festas, brinquedos, crianças e alimentação. A comunicação precisa transmitir diversão de forma real, mostrando crianças usando o espaço e famílias aproveitando o ambiente. A produção prioriza criança brincando, comida pronta, momento em família e cena espontânea que mostre a experiência. Conferir os perfis no Instagram antes de cada planejamento, para acompanhar atrações e novidades da temporada.\n\nCombinado de operação: As duas entregas semanais são fotos, não artes.', 'Buffet infantil para festas, único no formato buffet completo para eventos infantis da região. Endereço: Rua Gustavo Lira, 273, São João, Volta Redonda/RJ. Espaço centralizado e seguro, pensado para festas de aniversário e eventos em família. Entretenimento infantil e familiar: experiências, festas, brinquedos, crianças e alimentação. A comunicação precisa transmitir diversão de forma real, mostrando crianças usando o espaço e famílias aproveitando o ambiente. A produção prioriza criança brincando, comida pronta, momento em família e cena espontânea que mostre a experiência. Conferir os perfis no Instagram antes de cada planejamento, para acompanhar atrações e novidades da temporada.\n\nCombinado de operação: As duas entregas semanais são fotos, não artes. Endereço e posicionamento (único buffet do formato na região) confirmados por pesquisa pública em agosto de 2026.'],
  'Kbral Kids': ['Entretenimento infantil da mesma família do Kbral Park, faturado separado. A comunicação mostra crianças usando o espaço e famílias aproveitando o ambiente, com cenas espontâneas e comida pronta. Conferir o Instagram antes de cada planejamento, para acompanhar atrações e novidades da temporada.\n\nCombinado de operação: Entrega combinada junto com o Kbral Park.', 'Restaurante infantil da mesma família do Kbral Park, faturado separado. Endereço: Rua João Valiante, 89, Ano Bom, Barra Mansa/RJ. Cardápio com pizzas e hambúrgueres artesanais, ambiente pensado para famílias com monitoria, recreação infantil, pintura facial, piscina de bolinhas, escorregador, cesta de basquete, videogames e vila kids, além de motinhas elétricas. A comunicação mostra crianças usando o espaço e famílias aproveitando o ambiente, com cenas espontâneas e comida pronta. Conferir o Instagram antes de cada planejamento, para acompanhar atrações e novidades da temporada.\n\nCombinado de operação: Entrega combinada junto com o Kbral Park. Endereço e estrutura do espaço confirmados por pesquisa pública em agosto de 2026.'],
  'Mastermax Contabilidade': ['Escritório de contabilidade com comunicação educativa e estratégica para empresas, empreendedores, MEIs e pessoas com CNPJ. Visual profissional e corporativo. O conteúdo precisa simplificar assunto complexo sem perder autoridade. Pautas: CNPJ, MEI, tributação, Reforma Tributária, erros fiscais, suspensão de empresas e decisões importantes para o empresário.', 'Escritório de contabilidade em atuação desde 2008, com equipe de médio porte (entre 51 e 200 colaboradores) e atendimento em modelo de procedimentos automatizados. Endereço: Rua Prefeito Mário Pinto dos Reis, 51, Barra Mansa/RJ. Além da contabilidade tradicional, oferece consultoria e estruturação de holding familiar para proteção patrimonial e planejamento sucessório. Comunicação educativa e estratégica para empresas, empreendedores, MEIs e pessoas com CNPJ. Visual profissional e corporativo. O conteúdo precisa simplificar assunto complexo sem perder autoridade. Pautas: CNPJ, MEI, tributação, Reforma Tributária, erros fiscais, suspensão de empresas, holding familiar e decisões importantes para o empresário.\n\nCombinado de operação: Endereço, porte e serviço de holding familiar confirmados por pesquisa pública em agosto de 2026.'],
  'Mega Móveis': ['Loja de móveis com posicionamento muito comercial e popular, baseado em oferta, condição de pagamento e grandes campanhas promocionais. A identidade das ofertas usa roxo, magenta, laranja e amarelo, com produto grande e hierarquia forte para preço e parcelamento. Campanhas como Aniversário da Patroa, ofertas especiais, datas comemorativas e peças diretas para venda imediata.\n\nCombinado de operação: Sem cadência fixa. As demandas chegam pelo grupo e entram como avulsas, então este cliente fica de fora do planejamento automático.', 'Loja de móveis com posicionamento muito comercial e popular, baseado em oferta, condição de pagamento e grandes campanhas promocionais. A identidade das ofertas usa roxo, magenta, laranja e amarelo, com produto grande e hierarquia forte para preço e parcelamento. Campanhas como Aniversário da Patroa, ofertas especiais, datas comemorativas e peças diretas para venda imediata.\n\nCombinado de operação: Sem cadência fixa. As demandas chegam pelo grupo e entram como avulsas, então este cliente fica de fora do planejamento automático. Pesquisa pública em agosto de 2026 não confirmou dado adicional específico sobre a loja — manter esse briefing como está.'],
  'Barra Travel': ['Agência de viagens com pacotes nacionais e internacionais, hospedagem, passagem e experiências. A comunicação valoriza visualmente o destino, mantendo aparência profissional e aspiracional, com a informação comercial bem organizada. Produzimos divulgação de pacotes completos, condições de parcelamento, campanhas sazonais e destinos como Chile e Nova York.', 'Agência de viagens com pacotes nacionais e internacionais, hospedagem, passagem e experiências. A comunicação valoriza visualmente o destino, mantendo aparência profissional e aspiracional, com a informação comercial bem organizada. Produzimos divulgação de pacotes completos, condições de parcelamento, campanhas sazonais e destinos como Chile e Nova York.\n\nCombinado de operação: Pesquisa pública em agosto de 2026 não confirmou "Barra Travel" com esse nome exato entre as agências de turismo listadas em Barra Mansa — manter esse briefing como está até checagem com o cliente.'],
  'Camisaria Pinguim': ['Camisaria masculina com mix que inclui moda, ternos, carteiras, garrafas, bolsas, mochilas, malas, nécessaires e pastas. Comunicação comercial: valorizar produto, variedade, preço e oportunidade de compra sem sobrecarregar o layout. Conteúdos de vídeo de produto, campanhas de moda e ofertas, como ternos a partir de R$ 495.\n\nCombinado de operação: A entrega semanal costuma ser foto, não arte.', 'Camisaria masculina em operação desde 1970 — mais de 50 anos de história no Centro de Barra Mansa. Endereço: Avenida Joaquim Leite, Centro, Barra Mansa/RJ. Mix que inclui moda, ternos, carteiras, garrafas, bolsas, mochilas, malas, nécessaires e pastas. Comunicação comercial: valorizar produto, variedade, preço e oportunidade de compra sem sobrecarregar o layout — a tradição de décadas na cidade é um argumento de confiança a explorar. Conteúdos de vídeo de produto, campanhas de moda e ofertas, como ternos a partir de R$ 495.\n\nCombinado de operação: A entrega semanal costuma ser foto, não arte. Fundação (1970) e endereço confirmados por pesquisa pública em agosto de 2026.'],
};