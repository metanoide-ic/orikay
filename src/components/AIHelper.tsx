import { useEffect, useRef, useState } from 'react';
import { Sparkles, Send, Loader2, Check, X, ShieldAlert, Trash2 } from 'lucide-react';
import { Modal, Button } from '@/components/ui';
import { useAuth } from '@/lib/authStore';
import { chatStep, type AiChatMessage } from '@/lib/ai';
import { allToolSchemas, findTool } from '@/lib/aiTools';
import { cn } from '@/lib/utils';

const SISTEMA = `Você é a IA Helper da Orikay, a plataforma interna da agência Origem Comunicação & Marketing.
Você tem ferramentas de verdade pra ler e mexer na plataforma: posts, vídeos, clientes, cobranças e mensagens do WhatsApp (via Conector).
Regras:
- Fale português do Brasil, direto e sem enrolação.
- Antes de mudar ou criar algo, se precisar de um id (de post/vídeo/cliente/cobrança) que você não tem, use a ferramenta de listar correspondente pra achar — nunca invente um id.
- Nunca invente dado (número, valor, cliente, mensagem) que você não pegou de uma ferramenta.
- Ferramentas sensíveis (mandar WhatsApp, excluir) já pedem confirmação do admin sozinhas — não precisa avisar isso, só chame a ferramenta.
- Depois de executar ações, resuma em poucas linhas o que foi feito.
- Se a ferramenta devolver "erro", explique o erro pro admin em vez de tentar de novo do mesmo jeito.`;

interface ToolCall { id: string; type: 'function'; function: { name: string; arguments: string } }

/** Uma linha do chat pronta pra mostrar na tela (não é 1:1 com AiChatMessage — tool vira um cartão). */
type Linha =
  | { tipo: 'user'; texto: string }
  | { tipo: 'assistant'; texto: string }
  | { tipo: 'tool'; nome: string; resultado: unknown }
  | { tipo: 'erro'; texto: string };

const MAX_RODADAS = 8;

/**
 * IA Helper: assistente com acesso de verdade à plataforma (function
 * calling) — só admin vê o botão. Lê e mexe em posts, vídeos, clientes,
 * cobranças e WhatsApp (via Conector). Ações sensíveis (mandar mensagem,
 * excluir) sempre passam por uma confirmação antes de rodar.
 */
export function AIHelper() {
  const isAdmin = useAuth((s) => s.current()?.admin);
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [busy, setBusy] = useState(false);
  const [pendente, setPendente] = useState<{ call: ToolCall; args: Record<string, unknown> } | null>(null);
  const historico = useRef<AiChatMessage[]>([{ role: 'system', content: SISTEMA }]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [linhas, busy, pendente]);

  if (!isAdmin) return null;

  function reset() {
    historico.current = [{ role: 'system', content: SISTEMA }];
    lote.current = null;
    setLinhas([]);
    setInput('');
    setPendente(null);
    setBusy(false);
  }

  // Continuação de um lote de tool_calls de UMA resposta da IA — guardado
  // fora do estado (não precisa re-render) pra retomar do ponto certo
  // depois que uma ferramenta sensível pausa esperando confirmação.
  const lote = useRef<{ calls: ToolCall[]; idx: number; rodada: number } | null>(null);

  async function processarLote(): Promise<void> {
    const atual = lote.current;
    if (!atual) return;
    for (let i = atual.idx; i < atual.calls.length; i++) {
      const call = atual.calls[i];
      const tool = findTool(call.function.name);
      let args: Record<string, unknown> = {};
      try { args = JSON.parse(call.function.arguments || '{}'); } catch { /* args malformado, segue vazio */ }

      if (!tool) {
        const resultado = { erro: 'ferramenta desconhecida' };
        setLinhas((l) => [...l, { tipo: 'tool', nome: call.function.name, resultado }]);
        historico.current.push({ role: 'tool', tool_call_id: call.id, name: call.function.name, content: JSON.stringify(resultado) });
        continue;
      }
      if (tool.sensitive) {
        lote.current = { ...atual, idx: i }; // retoma exatamente aqui após confirmar
        setPendente({ call, args });
        return;
      }
      let resultado: unknown;
      try {
        resultado = await tool.run(args);
      } catch (e) {
        resultado = { erro: (e as Error).message };
      }
      setLinhas((l) => [...l, { tipo: 'tool', nome: call.function.name, resultado }]);
      historico.current.push({ role: 'tool', tool_call_id: call.id, name: call.function.name, content: JSON.stringify(resultado) });
    }
    const proximaRodada = atual.rodada + 1;
    lote.current = null;
    return rodar(proximaRodada);
  }

  async function rodar(rodada = 0): Promise<void> {
    if (rodada >= MAX_RODADAS) {
      setLinhas((l) => [...l, { tipo: 'erro', texto: 'Muitas ações em sequência — parei por segurança. Pode pedir pra continuar.' }]);
      setBusy(false);
      return;
    }
    setBusy(true);
    let resposta: AiChatMessage;
    try {
      resposta = await chatStep(historico.current, allToolSchemas());
    } catch (e) {
      setLinhas((l) => [...l, { tipo: 'erro', texto: (e as Error).message }]);
      setBusy(false);
      return;
    }
    historico.current.push(resposta);

    if (!resposta.tool_calls || resposta.tool_calls.length === 0) {
      if (resposta.content) setLinhas((l) => [...l, { tipo: 'assistant', texto: resposta.content! }]);
      setBusy(false);
      return;
    }

    lote.current = { calls: resposta.tool_calls as ToolCall[], idx: 0, rodada };
    return processarLote();
  }

  async function enviar() {
    const texto = input.trim();
    if (!texto || busy) return;
    setInput('');
    setLinhas((l) => [...l, { tipo: 'user', texto }]);
    historico.current.push({ role: 'user', content: texto });
    await rodar();
  }

  async function confirmar(ok: boolean) {
    if (!pendente || !lote.current) return;
    const { call, args } = pendente;
    setPendente(null);
    const tool = findTool(call.function.name)!;
    let resultado: unknown;
    if (!ok) {
      resultado = { cancelado: true, motivo: 'O admin não confirmou essa ação.' };
    } else {
      try {
        resultado = await tool.run(args);
      } catch (e) {
        resultado = { erro: (e as Error).message };
      }
    }
    setLinhas((l) => [...l, { tipo: 'tool', nome: call.function.name, resultado }]);
    historico.current.push({ role: 'tool', tool_call_id: call.id, name: call.function.name, content: JSON.stringify(resultado) });
    lote.current = { ...lote.current, idx: lote.current.idx + 1 };
    await processarLote();
  }

  function fechar() {
    setOpen(false);
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="IA Helper — assistente da plataforma"
        className="fixed bottom-6 right-6 z-40 grid h-13 w-13 place-items-center rounded-full bg-brand-500 text-white shadow-2xl shadow-brand-900/40 transition hover:bg-brand-400 hover:scale-105"
        style={{ height: 52, width: 52 }}
      >
        <Sparkles size={22} />
      </button>

      <Modal open={open} onClose={fechar} title="IA Helper" wide>
        <div className="flex h-[65vh] flex-col">
          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto pr-1">
            {linhas.length === 0 && !busy && (
              <div className="grid h-full place-items-center px-6 text-center text-sm text-white/40">
                <div>
                  <Sparkles size={28} className="mx-auto mb-3 text-brand-400/60" />
                  Pergunte, peça pra mexer em posts, vídeos, clientes, cobranças, ou pra ler o WhatsApp de um cliente.
                  <br /><br />
                  Ex.: "quais posts estão atrasados?", "cria um vídeo pro cliente X pra sexta", "lê o WhatsApp da Pizzaria Bella".
                </div>
              </div>
            )}
            {linhas.map((l, i) => <LinhaChat key={i} linha={l} />)}
            {pendente && <ConfirmacaoCard call={pendente.call} args={pendente.args} onConfirmar={confirmar} />}
            {busy && !pendente && (
              <div className="flex items-center gap-2 text-sm text-white/40">
                <Loader2 size={15} className="animate-spin" /> Pensando…
              </div>
            )}
          </div>

          <div className="mt-3 flex items-center gap-2 border-t border-line pt-3">
            <button onClick={reset} title="Nova conversa" className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-white/40 hover:bg-white/5 hover:text-white">
              <Trash2 size={16} />
            </button>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void enviar(); } }}
              placeholder="Peça alguma coisa…"
              disabled={busy || Boolean(pendente)}
              autoFocus
              className="h-10 flex-1 rounded-xl border border-line bg-ink-800/70 px-3.5 text-sm text-white placeholder:text-white/30 outline-none focus:border-brand-400/70"
            />
            <Button size="icon" onClick={() => void enviar()} disabled={!input.trim() || busy || Boolean(pendente)}>
              <Send size={16} />
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}

function LinhaChat({ linha }: { linha: Linha }) {
  if (linha.tipo === 'user') {
    return <div className="ml-auto max-w-[80%] rounded-2xl rounded-tr-sm bg-brand-500/20 px-3.5 py-2 text-sm text-white/90">{linha.texto}</div>;
  }
  if (linha.tipo === 'assistant') {
    return <div className="mr-auto max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-tl-sm bg-white/[0.04] px-3.5 py-2 text-sm text-white/85">{linha.texto}</div>;
  }
  if (linha.tipo === 'erro') {
    return <div className="mr-auto max-w-[85%] rounded-xl bg-red-500/10 px-3.5 py-2 text-xs text-red-300">{linha.texto}</div>;
  }
  // tool: mostra um resuminho discreto do que rodou, não o JSON cru inteiro.
  const r = linha.resultado as { erro?: string; ok?: boolean } | unknown;
  const erro = r && typeof r === 'object' && 'erro' in r ? String((r as { erro?: string }).erro) : null;
  return (
    <div className={cn('mr-auto flex items-center gap-2 rounded-lg px-3 py-1.5 text-[11px]', erro ? 'bg-red-500/10 text-red-300' : 'bg-white/[0.03] text-white/40')}>
      {erro ? <X size={12} /> : <Check size={12} />}
      <span className="font-medium">{linha.nome}</span>
      {erro && <span>— {erro}</span>}
    </div>
  );
}

function ConfirmacaoCard({ call, args, onConfirmar }: { call: ToolCall; args: Record<string, unknown>; onConfirmar: (ok: boolean) => void }) {
  const nome = call.function.name;
  const descricao =
    nome === 'enviar_mensagem_whatsapp'
      ? `Mandar essa mensagem pra: ${(args.clientesIdsOuNomes as string[] | undefined)?.join(', ') ?? '—'}\n\n"${args.mensagem}"`
      : nome === 'excluir_item'
        ? `Excluir ${args.tipo} definitivamente (id ${args.id}). Isso não pode ser desfeito.`
        : JSON.stringify(args);

  return (
    <div className="rounded-2xl border border-amber-400/30 bg-amber-500/[0.06] p-4">
      <div className="mb-2 flex items-center gap-2 text-sm font-medium text-amber-200">
        <ShieldAlert size={16} /> Confirmar ação
      </div>
      <p className="mb-3 whitespace-pre-wrap text-sm text-white/75">{descricao}</p>
      <div className="flex gap-2">
        <Button size="sm" onClick={() => onConfirmar(true)}><Check size={14} /> Confirmar</Button>
        <Button size="sm" variant="ghost" onClick={() => onConfirmar(false)}><X size={14} /> Cancelar</Button>
      </div>
    </div>
  );
}
