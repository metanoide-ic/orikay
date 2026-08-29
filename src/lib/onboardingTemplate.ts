import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { uid } from './utils';
import type { OnboardingChecklistItem } from './types';

/** Um item do modelo padrão — vira um `OnboardingChecklistItem` ao ser clonado para um cliente. */
export interface OnboardingTemplateItem {
  id: string;
  section: string;
  text: string;
}

/**
 * Modelo padrão aplicado a todo cliente novo. Cobre o essencial de
 * onboarding e entrega de uma conta na agência — quem cuida do dia a dia
 * pode ajustar em "Checklist de Clientes → Editar modelo padrão".
 */
const DEFAULT_TEMPLATE: Array<{ section: string; text: string }> = [
  { section: 'Cadastro & Contrato', text: 'Contrato assinado' },
  { section: 'Cadastro & Contrato', text: 'Dados fiscais e de faturamento coletados' },
  { section: 'Cadastro & Contrato', text: 'Forma de pagamento definida' },
  { section: 'Briefing & Acesso', text: 'Briefing de marca preenchido' },
  { section: 'Briefing & Acesso', text: 'Acesso às redes sociais recebido' },
  { section: 'Briefing & Acesso', text: 'Acesso a Drive/ativos visuais recebido' },
  { section: 'Briefing & Acesso', text: 'Cadência semanal definida' },
  { section: 'Produção', text: 'Manual de marca revisado com o time' },
  { section: 'Produção', text: 'Biblioteca de posts/templates configurada' },
  { section: 'Produção', text: 'Primeiro planejamento mensal aprovado' },
  { section: 'Financeiro & Tráfego', text: 'Verba de tráfego pago definida (se houver)' },
  { section: 'Financeiro & Tráfego', text: 'Região de entrega/segmentação configurada' },
  { section: 'Acompanhamento', text: 'Grupo de WhatsApp criado com o cliente' },
  { section: 'Acompanhamento', text: 'Responsável interno designado' },
  { section: 'Acompanhamento', text: 'Reunião de kickoff realizada' },
];

function seed(): OnboardingTemplateItem[] {
  return DEFAULT_TEMPLATE.map((t) => ({ id: uid('tmpl'), ...t }));
}

interface TemplateState {
  items: OnboardingTemplateItem[];
  renameItem: (id: string, text: string) => void;
  removeItem: (id: string) => void;
  addItem: (section: string, text: string) => void;
  addSection: (name: string) => void;
  /** Gera uma cópia independente do modelo, pronta para virar a checklist de um cliente novo. */
  cloneForClient: () => OnboardingChecklistItem[];
}

export const useOnboardingTemplate = create<TemplateState>()(
  persist(
    (set, get) => ({
      items: seed(),

      renameItem: (id, text) =>
        set((s) => ({ items: s.items.map((i) => (i.id === id ? { ...i, text } : i)) })),

      removeItem: (id) => set((s) => ({ items: s.items.filter((i) => i.id !== id) })),

      addItem: (section, text) => {
        if (!text.trim()) return;
        set((s) => ({ items: [...s.items, { id: uid('tmpl'), section, text: text.trim() }] }));
      },

      addSection: (name) => {
        if (!name.trim()) return;
        set((s) => ({ items: [...s.items, { id: uid('tmpl'), section: name.trim(), text: 'Novo item' }] }));
      },

      cloneForClient: () =>
        get().items.map((t) => ({ id: uid('oci'), section: t.section, text: t.text, done: false })),
    }),
    { name: 'origem-onboarding-template' },
  ),
);
