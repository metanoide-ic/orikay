import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Settings {
  // --- IA (copy) ---
  aiMode: 'template' | 'api';
  aiEndpoint: string; // URL compatível com OpenAI /chat/completions
  aiKey: string;
  aiModel: string;
  brandVoice: string; // tom de voz da marca

  // --- Publicação (Instagram) ---
  publishWebhook: string;
  autoPublishOnApproval: boolean;

  // --- WhatsApp ---
  whatsappWebhook: string;
  whatsappGroup: string;
  sendOnApprovalStage: boolean;

  // --- Notificações ---
  notifyEnabled: boolean;

  /** Endereço do Conector Orikay, para recursos que precisam de resposta. */
  connectorUrl: string;

  // --- Cobrança ---
  /** Chave Pix da agência (vai na mensagem de cobrança). */
  pixKey: string;
  /** WhatsApp do contador, para pedidos de nota fiscal. */
  contadorWhatsapp: string;
  /** Gera as cobranças do mês automaticamente ao abrir o Financeiro. */
  autoBilling: boolean;
  /** Última data (AAAA-MM-DD) em que a cobrança automática do dia já rodou. */
  lastAutoBillingRun: string;
}

interface SettingsState extends Settings {
  update: (patch: Partial<Settings>) => void;
}

const defaults: Settings = {
  aiMode: 'template',
  aiEndpoint: 'https://api.groq.com/openai/v1/chat/completions',
  aiKey: '',
  aiModel: 'llama-3.3-70b-versatile',
  brandVoice:
    'Tom moderno, direto e confiante. Marketing com estratégia e resultado. Não use emojis.',
  publishWebhook: '',
  autoPublishOnApproval: true,
  whatsappWebhook: '',
  whatsappGroup: '',
  sendOnApprovalStage: true,
  notifyEnabled: false,
  connectorUrl: '',
  pixKey: '',
  contadorWhatsapp: '',
  autoBilling: true,
  lastAutoBillingRun: '',
};

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      ...defaults,
      update: (patch) => set(patch),
    }),
    { name: 'origem.settings' },
  ),
);
