import type { Board, Client, WorkspaceData } from './types';
import { uid } from './utils';

/**
 * Dados de exemplo para quem abre a plataforma sem nuvem (modo local), só
 * para a tela não nascer vazia. Clientes inventados: nenhuma carteira real
 * de agência pode morar no código, que vai inteiro para o navegador de quem
 * abre o site.
 */

/** Dias da semana: 1 = segunda ... 5 = sexta. */
const TER = 2, QUA = 3, QUI = 4, SEX = 5;

const EXEMPLOS: Array<Pick<Client, 'name' | 'color' | 'briefing' | 'weeklyPlan' | 'serviceArea'>> = [
  {
    name: 'Panificadora São Judas',
    color: '#d97706',
    briefing: 'Padaria de bairro com fornada às 5h. Comunicação próxima, foto de produto saindo do forno, promoções do dia e encomendas para festas.',
    weeklyPlan: { [TER]: ['Foto'], [SEX]: ['Vídeo'] },
    serviceArea: 'cidade',
  },
  {
    name: 'Ótica Ramalho',
    color: '#0ea5e9',
    briefing: 'Ótica de rua com laboratório próprio. Coleções de armações, exame de vista parceiro e condições de parcelamento.',
    weeklyPlan: { [QUA]: ['Post'], [SEX]: ['Post'] },
    serviceArea: 'cidade',
  },
  {
    name: 'Clínica Lobo & Assis',
    color: '#10b981',
    briefing: 'Clínica odontológica. Conteúdo educativo sobre clareamento, implante e prevenção, sem promessa de resultado.',
    weeklyPlan: { [TER]: ['Vídeo'], [QUI]: ['Post'] },
    serviceArea: 'cidade',
  },
  {
    name: 'JR Freios e Peças',
    color: '#ef4444',
    briefing: 'Autopeças e oficina de freios. Dicas de manutenção, revisão antes de viajar e ofertas de peças.',
    weeklyPlan: { [QUA]: ['Foto'] },
    serviceArea: 'cidade',
  },
  {
    name: 'Studio K',
    color: '#a855f7',
    briefing: 'Estúdio de pilates. Aulas experimentais, rotina dos alunos e benefícios do pilates para postura.',
    weeklyPlan: { [TER]: ['Vídeo'], [QUI]: ['Foto'] },
    serviceArea: 'cidade',
  },
];

export function seedData(): WorkspaceData {
  const clients: Client[] = EXEMPLOS.map((c) => ({ ...c, id: uid('cli'), createdAt: Date.now() }));

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
