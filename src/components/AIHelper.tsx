import { useMemo, useState } from 'react';
import { Sparkles, Send, Loader2, CheckCircle2 } from 'lucide-react';
import { Button, Field, Textarea, Input, Modal } from '@/components/ui';
import { useData } from '@/lib/dataStore';
import { draftBroadcastMessage } from '@/lib/ai';
import { sendBroadcast, clientesComGrupo } from '@/lib/broadcast';
import { cn } from '@/lib/utils';

type Passo = 'escrever' | 'revisar' | 'enviando' | 'feito';

/**
 * IA Helper: dispara a mesma mensagem no WhatsApp pra vários clientes de
 * uma vez. A escolha de quem recebe é sempre feita na tela (checkboxes) —
 * a IA só ajuda a lapidar o texto quando uma chave está configurada; nunca
 * decide sozinha quem é o alvo, pra nunca mandar pra quem não devia.
 */
export function AIHelper() {
  const [open, setOpen] = useState(false);
  const [instrucao, setInstrucao] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [busca, setBusca] = useState('');
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [passo, setPasso] = useState<Passo>('escrever');
  const [lapidando, setLapidando] = useState(false);
  const [resultado, setResultado] = useState<{ enviados: number; falhas: number } | null>(null);

  const clients = useData((s) => s.clients);
  const alvosPossiveis = useMemo(() => clientesComGrupo(), [clients]);
  const filtrados = useMemo(
    () => alvosPossiveis.filter((c) => c.name.toLowerCase().includes(busca.toLowerCase())),
    [alvosPossiveis, busca],
  );

  function reset() {
    setInstrucao('');
    setMensagem('');
    setBusca('');
    setSelecionados(new Set());
    setPasso('escrever');
    setResultado(null);
  }

  function fechar() {
    setOpen(false);
    setTimeout(reset, 250);
  }

  function alternar(id: string) {
    setSelecionados((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }

  async function avancar() {
    if (!instrucao.trim()) return;
    setLapidando(true);
    const texto = await draftBroadcastMessage(instrucao);
    setMensagem(texto);
    setLapidando(false);
    setPasso('revisar');
  }

  async function enviar() {
    const alvos = alvosPossiveis.filter((c) => selecionados.has(c.id));
    if (alvos.length === 0 || !mensagem.trim()) return;
    setPasso('enviando');
    const r = await sendBroadcast(mensagem, alvos);
    setResultado(r);
    setPasso('feito');
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="IA Helper — mandar mensagem em massa"
        className="fixed bottom-6 right-6 z-40 grid h-13 w-13 place-items-center rounded-full bg-brand-500 text-white shadow-2xl shadow-brand-900/40 transition hover:bg-brand-400 hover:scale-105"
        style={{ height: 52, width: 52 }}
      >
        <Sparkles size={22} />
      </button>

      <Modal open={open} onClose={fechar} title="IA Helper" wide>
        {passo === 'escrever' && (
          <div className="space-y-4">
            <p className="text-sm text-white/50">
              Diga o que quer avisar. Ex.: "avisa que amanhã é feriado e não vai ter postagem" —
              a IA lapida o texto e, na próxima tela, você escolhe pra quem mandar.
            </p>
            <Field label="O que você quer mandar?">
              <Textarea
                rows={4}
                autoFocus
                value={instrucao}
                onChange={(e) => setInstrucao(e.target.value)}
                placeholder="Ex.: avisa todo mundo que a agência vai fechar na sexta-feira"
              />
            </Field>
          </div>
        )}

        {passo === 'revisar' && (
          <div className="space-y-4">
            <Field label="Mensagem (edite se quiser)">
              <Textarea rows={5} value={mensagem} onChange={(e) => setMensagem(e.target.value)} />
            </Field>
            <Field label={`Para quem? (${selecionados.size} selecionado(s) de ${alvosPossiveis.length} com grupo cadastrado)`}>
              <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar cliente…" className="mb-2" />
              <div className="max-h-56 overflow-y-auto rounded-xl border border-line divide-y divide-line">
                <button
                  onClick={() => setSelecionados(new Set(selecionados.size === filtrados.length ? [] : filtrados.map((c) => c.id)))}
                  className="w-full px-3.5 py-2 text-left text-xs font-medium text-brand-300 hover:bg-white/5"
                >
                  {selecionados.size === filtrados.length && filtrados.length > 0 ? 'Desmarcar todos' : 'Selecionar todos os filtrados'}
                </button>
                {filtrados.length === 0 && (
                  <p className="px-3.5 py-4 text-center text-xs text-white/35">Nenhum cliente com grupo de WhatsApp cadastrado.</p>
                )}
                {filtrados.map((c) => (
                  <label key={c.id} className="flex cursor-pointer items-center gap-2.5 px-3.5 py-2 text-sm text-white/80 hover:bg-white/5">
                    <input type="checkbox" checked={selecionados.has(c.id)} onChange={() => alternar(c.id)} className="accent-brand-500" />
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: c.color }} />
                    {c.name}
                  </label>
                ))}
              </div>
            </Field>
          </div>
        )}

        {passo === 'enviando' && (
          <div className="flex flex-col items-center gap-3 py-10 text-white/60">
            <Loader2 size={28} className="animate-spin text-brand-300" />
            <p className="text-sm">Enviando pros grupos…</p>
          </div>
        )}

        {passo === 'feito' && resultado && (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <CheckCircle2 size={32} className="text-emerald-400" />
            <p className="text-white">
              {resultado.enviados} enviada(s){resultado.falhas > 0 && <span className="text-red-300"> · {resultado.falhas} falha(s)</span>}
            </p>
            <p className="text-xs text-white/40">Confira os detalhes no histórico, na tela de Integrações.</p>
          </div>
        )}

        <div className={cn('mt-5 flex justify-end gap-2', passo === 'enviando' && 'invisible')}>
          {passo === 'escrever' && (
            <Button onClick={avancar} disabled={!instrucao.trim() || lapidando}>
              {lapidando ? <><Loader2 size={16} className="animate-spin" /> Lapidando…</> : <>Continuar <Send size={15} /></>}
            </Button>
          )}
          {passo === 'revisar' && (
            <>
              <Button variant="ghost" onClick={() => setPasso('escrever')}>Voltar</Button>
              <Button onClick={enviar} disabled={selecionados.size === 0 || !mensagem.trim()}>
                <Send size={15} /> Mandar pra {selecionados.size} cliente(s)
              </Button>
            </>
          )}
          {passo === 'feito' && <Button onClick={fechar}>Fechar</Button>}
        </div>
      </Modal>
    </>
  );
}
