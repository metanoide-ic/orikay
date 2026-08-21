import { useData } from './dataStore';
import { useSettings } from './settingsStore';
import { STAGE_ORDER, VIDEO_STAGE_ORDER, PLATFORMS } from './labels';
import { connectorPath } from './inbox';
import { sendBroadcast } from './broadcast';
import { markChargePaid, isOverdue, monthLabel } from './billing';
import { todayISO } from './utils';
import type { AiTool } from './ai';
import type { PostStage, VideoStage, PostPlatform } from './types';

/**
 * Ferramentas que a IA Helper pode executar de verdade na plataforma.
 * Cada uma tem: o schema (o que a IA vê), se é sensível (pausa pra
 * confirmação antes de rodar) e a implementação (mexe direto no
 * dataStore/conector). Isso é o "corpo" da IA Helper — pra dar mais poder
 * a ela, é aqui que se adiciona uma ferramenta nova.
 */
export interface ToolDef {
  schema: AiTool;
  /** true = a IA Helper mostra o que vai fazer e espera confirmar antes de rodar. */
  sensitive?: boolean;
  run: (args: Record<string, unknown>) => unknown | Promise<unknown>;
}

function achar<T extends { id: string }>(lista: T[], id: string): T | undefined {
  return lista.find((x) => x.id === id);
}

/** Resolve um cliente por id OU por nome (aproximado) — a IA nem sempre sabe o id de cor. */
function acharCliente(idOuNome: string) {
  const clients = useData.getState().clients;
  const porId = clients.find((c) => c.id === idOuNome);
  if (porId) return porId;
  const alvo = idOuNome.trim().toLowerCase();
  return (
    clients.find((c) => c.name.toLowerCase() === alvo) ??
    clients.find((c) => c.name.toLowerCase().includes(alvo))
  );
}

const TOOLS: ToolDef[] = [
  // ---------------------------- Leitura ----------------------------
  {
    schema: {
      type: 'function',
      function: {
        name: 'listar_clientes',
        description: 'Lista todos os clientes da carteira, com id, nome, briefing resumido e se tem grupo de WhatsApp cadastrado.',
        parameters: { type: 'object', properties: {} },
      },
    },
    run: () =>
      useData.getState().clients.map((c) => ({
        id: c.id,
        nome: c.name,
        briefing: c.briefing?.slice(0, 200),
        temGrupoWhatsapp: Boolean(c.whatsappGroup),
        fee: c.monthlyFee,
      })),
  },
  {
    schema: {
      type: 'function',
      function: {
        name: 'listar_posts',
        description: 'Lista posts do quadro, com filtros opcionais. Sem filtro nenhum, lista tudo (pode ser bastante coisa).',
        parameters: {
          type: 'object',
          properties: {
            clienteIdOuNome: { type: 'string', description: 'Filtra por cliente (id ou nome).' },
            etapa: { type: 'string', enum: STAGE_ORDER, description: 'Filtra por etapa do post.' },
            somenteAtrasados: { type: 'boolean', description: 'Só posts com data prevista já passada e ainda não publicados.' },
          },
        },
      },
    },
    run: (args) => {
      const { posts, clients } = useData.getState();
      const hoje = todayISO();
      let lista = posts;
      if (args.clienteIdOuNome) {
        const c = acharCliente(String(args.clienteIdOuNome));
        lista = c ? lista.filter((p) => p.clientId === c.id) : [];
      }
      if (args.etapa) lista = lista.filter((p) => p.stage === (args.etapa as PostStage));
      if (args.somenteAtrasados) lista = lista.filter((p) => p.scheduledDate && p.scheduledDate < hoje && p.stage !== 'publicado');
      return lista.slice(0, 80).map((p) => ({
        id: p.id, titulo: p.title, cliente: clients.find((c) => c.id === p.clientId)?.name,
        etapa: p.stage, plataforma: p.platform, dataPrevista: p.scheduledDate, arquivado: Boolean(p.archived),
      }));
    },
  },
  {
    schema: {
      type: 'function',
      function: {
        name: 'listar_videos',
        description: 'Lista projetos de vídeo, com filtros opcionais.',
        parameters: {
          type: 'object',
          properties: {
            clienteIdOuNome: { type: 'string' },
            etapa: { type: 'string', enum: VIDEO_STAGE_ORDER },
            somenteAtrasados: { type: 'boolean' },
          },
        },
      },
    },
    run: (args) => {
      const { videos, clients } = useData.getState();
      const hoje = todayISO();
      let lista = videos;
      if (args.clienteIdOuNome) {
        const c = acharCliente(String(args.clienteIdOuNome));
        lista = c ? lista.filter((v) => v.clientId === c.id) : [];
      }
      if (args.etapa) lista = lista.filter((v) => v.stage === (args.etapa as VideoStage));
      if (args.somenteAtrasados) lista = lista.filter((v) => v.dueDate && v.dueDate < hoje && v.stage !== 'entregue');
      return lista.slice(0, 80).map((v) => ({
        id: v.id, titulo: v.title, cliente: clients.find((c) => c.id === v.clientId)?.name,
        etapa: v.stage, prazo: v.dueDate, arquivado: Boolean(v.archived),
      }));
    },
  },
  {
    schema: {
      type: 'function',
      function: {
        name: 'listar_cobrancas',
        description: 'Lista cobranças (financeiro), com filtro opcional por status.',
        parameters: {
          type: 'object',
          properties: {
            status: { type: 'string', enum: ['pendente', 'enviada', 'paga', 'atrasada'], description: '"atrasada" é calculado (vencimento passou e não foi paga), não é um status salvo.' },
          },
        },
      },
    },
    run: (args) => {
      const { charges, clients } = useData.getState();
      let lista = charges;
      if (args.status === 'atrasada') lista = lista.filter(isOverdue);
      else if (args.status) lista = lista.filter((c) => c.status === args.status);
      return lista.slice(0, 100).map((c) => ({
        id: c.id, cliente: clients.find((cl) => cl.id === c.clientId)?.name,
        mes: monthLabel(c.month), valor: c.amount, vencimento: c.dueDate, status: c.status, atrasada: isOverdue(c),
      }));
    },
  },
  {
    schema: {
      type: 'function',
      function: {
        name: 'ler_whatsapp',
        description: 'Lê as mensagens recentes recebidas no WhatsApp (via Conector). Precisa do Conector configurado e rodando.',
        parameters: {
          type: 'object',
          properties: {
            clienteIdOuNome: { type: 'string', description: 'Filtra pelo grupo/número desse cliente, se informado.' },
            minutos: { type: 'number', description: 'Só mensagens dos últimos N minutos. Padrão: sem limite (as últimas guardadas).' },
          },
        },
      },
    },
    run: async (args) => {
      const { connectorUrl } = useSettings.getState();
      if (!connectorUrl) return { erro: 'Conector não configurado — não dá pra ler o WhatsApp sem ele. Configure em Ajustes/Integrações.' };
      const params = new URLSearchParams();
      if (args.minutos) params.set('desde', String(Date.now() - Number(args.minutos) * 60_000));
      if (args.clienteIdOuNome) {
        const c = acharCliente(String(args.clienteIdOuNome));
        if (c?.whatsappGroup) params.set('grupo', c.whatsappGroup);
        else return { erro: 'Esse cliente não tem grupo de WhatsApp cadastrado.' };
      }
      try {
        // O separador depende do endereço: com "?token=" já na URL (túnel
        // trancado) é "&"; sem token (localhost) é "?".
        const base = connectorPath(connectorUrl, '/mensagens');
        const url = params.toString() ? `${base}${base.includes('?') ? '&' : '?'}${params}` : base;
        const res = await fetch(url);
        const data = await res.json();
        if (!data?.ok) return { erro: 'Conector não respondeu direito.' };
        const clients = useData.getState().clients;
        return (data.mensagens as Array<{ grupo: string; texto: string; quando: number }>).map((m) => ({
          cliente: clients.find((c) => c.whatsappGroup === m.grupo)?.name ?? m.grupo,
          texto: m.texto,
          quando: new Date(m.quando).toLocaleString('pt-BR'),
        }));
      } catch {
        return { erro: 'Não consegui falar com o Conector — confirme se ele está aberto e o endereço em Ajustes está certo.' };
      }
    },
  },

  // ---------------------------- Escrita ----------------------------
  {
    schema: {
      type: 'function',
      function: {
        name: 'criar_post',
        description: 'Cria um post novo no quadro, na etapa "ideia".',
        parameters: {
          type: 'object',
          properties: {
            titulo: { type: 'string' },
            clienteIdOuNome: { type: 'string' },
            plataforma: { type: 'string', enum: PLATFORMS },
            dataPrevista: { type: 'string', description: 'Data ISO (AAAA-MM-DD), opcional.' },
            copy: { type: 'string', description: 'Legenda/copy do post, opcional.' },
          },
          required: ['titulo'],
        },
      },
    },
    run: (args) => {
      const c = args.clienteIdOuNome ? acharCliente(String(args.clienteIdOuNome)) : undefined;
      const post = useData.getState().addPost({
        title: String(args.titulo),
        platform: (args.plataforma as PostPlatform) || 'Instagram',
        clientId: c?.id,
        stage: 'ideia',
        scheduledDate: args.dataPrevista ? String(args.dataPrevista) : undefined,
        copy: args.copy ? String(args.copy) : undefined,
      });
      return { ok: true, id: post.id };
    },
  },
  {
    schema: {
      type: 'function',
      function: {
        name: 'atualizar_post',
        description: 'Atualiza um post existente: mover de etapa, editar título/copy/data, arquivar.',
        parameters: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'Id do post (use listar_posts pra achar).' },
            etapa: { type: 'string', enum: STAGE_ORDER },
            titulo: { type: 'string' },
            copy: { type: 'string' },
            dataPrevista: { type: 'string' },
            arquivar: { type: 'boolean' },
          },
          required: ['id'],
        },
      },
    },
    run: (args) => {
      const { posts, updatePost, movePost } = useData.getState();
      const post = achar(posts, String(args.id));
      if (!post) return { erro: 'Post não encontrado. Confira o id com listar_posts.' };
      const patch: Record<string, unknown> = {};
      if (args.titulo) patch.title = args.titulo;
      if (args.copy) patch.copy = args.copy;
      if (args.dataPrevista) patch.scheduledDate = args.dataPrevista;
      if (args.arquivar !== undefined) patch.archived = args.arquivar;
      if (Object.keys(patch).length) updatePost(post.id, patch);
      if (args.etapa) movePost(post.id, args.etapa as PostStage, 0);
      return { ok: true };
    },
  },
  {
    schema: {
      type: 'function',
      function: {
        name: 'criar_video',
        description: 'Cria um projeto de vídeo novo, na etapa "briefing".',
        parameters: {
          type: 'object',
          properties: {
            titulo: { type: 'string' },
            clienteIdOuNome: { type: 'string' },
            prazo: { type: 'string', description: 'Data ISO (AAAA-MM-DD), opcional.' },
            notas: { type: 'string' },
          },
          required: ['titulo'],
        },
      },
    },
    run: (args) => {
      const c = args.clienteIdOuNome ? acharCliente(String(args.clienteIdOuNome)) : undefined;
      const video = useData.getState().addVideo({
        title: String(args.titulo), clientId: c?.id,
        dueDate: args.prazo ? String(args.prazo) : undefined,
        notes: args.notas ? String(args.notas) : undefined,
      });
      return { ok: true, id: video.id };
    },
  },
  {
    schema: {
      type: 'function',
      function: {
        name: 'atualizar_video',
        description: 'Atualiza um projeto de vídeo: mover de etapa, editar título/notas/prazo, arquivar.',
        parameters: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            etapa: { type: 'string', enum: VIDEO_STAGE_ORDER },
            titulo: { type: 'string' },
            notas: { type: 'string' },
            prazo: { type: 'string' },
            arquivar: { type: 'boolean' },
          },
          required: ['id'],
        },
      },
    },
    run: (args) => {
      const { videos, updateVideo, moveVideo } = useData.getState();
      const video = achar(videos, String(args.id));
      if (!video) return { erro: 'Vídeo não encontrado. Confira o id com listar_videos.' };
      const patch: Record<string, unknown> = {};
      if (args.titulo) patch.title = args.titulo;
      if (args.notas) patch.notes = args.notas;
      if (args.prazo) patch.dueDate = args.prazo;
      if (args.arquivar !== undefined) patch.archived = args.arquivar;
      if (Object.keys(patch).length) updateVideo(video.id, patch);
      if (args.etapa) moveVideo(video.id, args.etapa as VideoStage);
      return { ok: true };
    },
  },
  {
    schema: {
      type: 'function',
      function: {
        name: 'criar_cliente',
        description: 'Cadastra um cliente novo na carteira.',
        parameters: {
          type: 'object',
          properties: {
            nome: { type: 'string' },
            briefing: { type: 'string' },
            whatsappGroup: { type: 'string', description: 'Id do grupo de WhatsApp, se já souber.' },
            monthlyFee: { type: 'number' },
          },
          required: ['nome'],
        },
      },
    },
    run: (args) => {
      const client = useData.getState().addClient({
        name: String(args.nome), color: '#7c5cff',
        briefing: args.briefing ? String(args.briefing) : undefined,
        whatsappGroup: args.whatsappGroup ? String(args.whatsappGroup) : undefined,
        monthlyFee: args.monthlyFee ? Number(args.monthlyFee) : undefined,
      });
      return { ok: true, id: client.id };
    },
  },
  {
    schema: {
      type: 'function',
      function: {
        name: 'atualizar_cliente',
        description: 'Atualiza dados de um cliente já cadastrado (briefing, cadência, contato etc.).',
        parameters: {
          type: 'object',
          properties: {
            clienteIdOuNome: { type: 'string' },
            briefing: { type: 'string' },
            monthlyFee: { type: 'number' },
          },
          required: ['clienteIdOuNome'],
        },
      },
    },
    run: (args) => {
      const c = acharCliente(String(args.clienteIdOuNome));
      if (!c) return { erro: 'Cliente não encontrado.' };
      const patch: Record<string, unknown> = {};
      if (args.briefing) patch.briefing = args.briefing;
      if (args.monthlyFee) patch.monthlyFee = Number(args.monthlyFee);
      useData.getState().updateClient(c.id, patch);
      return { ok: true };
    },
  },
  {
    schema: {
      type: 'function',
      function: {
        name: 'marcar_cobranca_paga',
        description: 'Marca uma cobrança como paga.',
        parameters: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
      },
    },
    run: (args) => {
      const charge = achar(useData.getState().charges, String(args.id));
      if (!charge) return { erro: 'Cobrança não encontrada. Confira o id com listar_cobrancas.' };
      markChargePaid(charge.id);
      return { ok: true };
    },
  },
  {
    schema: {
      type: 'function',
      function: {
        name: 'enviar_mensagem_whatsapp',
        description: 'Manda uma mensagem no WhatsApp pro grupo de um ou mais clientes. AÇÃO SENSÍVEL: sempre confirmada com o admin antes de rodar de verdade.',
        parameters: {
          type: 'object',
          properties: {
            clientesIdsOuNomes: { type: 'array', items: { type: 'string' }, description: 'Lista de clientes (id ou nome) que vão receber.' },
            mensagem: { type: 'string' },
          },
          required: ['clientesIdsOuNomes', 'mensagem'],
        },
      },
    },
    sensitive: true,
    run: async (args) => {
      const nomes = args.clientesIdsOuNomes as string[];
      const alvos = nomes.map((n) => acharCliente(n)).filter((c): c is NonNullable<typeof c> => Boolean(c && c.whatsappGroup));
      if (alvos.length === 0) return { erro: 'Nenhum dos clientes informados tem grupo de WhatsApp cadastrado.' };
      const r = await sendBroadcast(String(args.mensagem), alvos);
      return { ok: true, enviados: r.enviados, falhas: r.falhas, para: alvos.map((c) => c.name) };
    },
  },
  {
    schema: {
      type: 'function',
      function: {
        name: 'excluir_item',
        description: 'Exclui definitivamente um post ou vídeo. AÇÃO SENSÍVEL: sempre confirmada antes de rodar. Prefira "arquivar" (via atualizar_post/atualizar_video) quando der.',
        parameters: {
          type: 'object',
          properties: {
            tipo: { type: 'string', enum: ['post', 'video'] },
            id: { type: 'string' },
          },
          required: ['tipo', 'id'],
        },
      },
    },
    sensitive: true,
    run: (args) => {
      const store = useData.getState();
      if (args.tipo === 'post') {
        if (!achar(store.posts, String(args.id))) return { erro: 'Post não encontrado.' };
        store.removePost(String(args.id));
      } else {
        if (!achar(store.videos, String(args.id))) return { erro: 'Vídeo não encontrado.' };
        store.removeVideo(String(args.id));
      }
      return { ok: true };
    },
  },
];

export function allToolSchemas(): AiTool[] {
  return TOOLS.map((t) => t.schema);
}

export function findTool(name: string): ToolDef | undefined {
  return TOOLS.find((t) => t.schema.function.name === name);
}
