import { useState } from 'react';
import { Trash2, Sparkles, Loader2, Send, Check, X, Copy as CopyIcon, VideoOff } from 'lucide-react';
import { Modal, Button, Field, Input, Textarea, Select, SearchSelect, AttachmentsGallery } from './ui';
import { RevisionList } from './RevisionList';
import { useData } from '@/lib/dataStore';
import { useAuth } from '@/lib/authStore';
import { useSettings } from '@/lib/settingsStore';
import { STAGE_META, STAGE_ORDER, PLATFORMS } from '@/lib/labels';
import { generateCopy } from '@/lib/ai';
import { sendForApproval, onApproved, onRejected, onPostStageChange, markPublishedManual } from '@/lib/automations';
import { cn } from '@/lib/utils';
import type { PostPlatform } from '@/lib/types';

export function PostModal({ postId, onClose }: { postId: string; onClose: () => void }) {
  const post = useData((s) => s.posts.find((p) => p.id === postId));
  const clients = useData((s) => s.clients);
  const updatePost = useData((s) => s.updatePost);
  const removePost = useData((s) => s.removePost);
  const members = useAuth((s) => s.accounts);
  const addRevision = useData((s) => s.addRevision);
  const updateRevision = useData((s) => s.updateRevision);
  const removeRevision = useData((s) => s.removeRevision);
  const whatsappReady = useSettings((s) => Boolean(s.whatsappWebhook || s.connectorUrl));

  const [genLoading, setGenLoading] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [rejectText, setRejectText] = useState('');
  const [copied, setCopied] = useState(false);

  if (!post) return null;

  function changeStage(stage: typeof STAGE_ORDER[number]) {
    if (!post || stage === post.stage) return;
    const from = post.stage;
    updatePost(postId, { stage });
    onPostStageChange(postId, from, stage);
  }

  async function genCopy() {
    if (!post) return;
    setGenLoading(true);
    const client = clients.find((c) => c.id === post.clientId);
    const copy = await generateCopy(post, client);
    updatePost(postId, { copy });
    setGenLoading(false);
  }

  const anexos = post.mediaUrls ?? (post.mediaUrl ? [post.mediaUrl] : []);
  function addAnexos(novos: string[]) {
    updatePost(postId, { mediaUrls: [...anexos, ...novos], mediaUrl: undefined });
  }
  function removeAnexo(i: number) {
    updatePost(postId, { mediaUrls: anexos.filter((_, idx) => idx !== i), mediaUrl: undefined });
  }
  function makeCover(i: number) {
    const next = [anexos[i], ...anexos.filter((_, idx) => idx !== i)];
    updatePost(postId, { mediaUrls: next, mediaUrl: undefined });
  }

  const inApproval = post.stage === 'aprovacao';
  const inRevision = post.stage === 'alteracao';

  return (
    <Modal open onClose={onClose} wide title="Post">
      <div className="space-y-5">
        <Field label="Título / tema">
          <Input value={post.title} onChange={(e) => updatePost(postId, { title: e.target.value })} />
        </Field>

        {/* Descrição — o que o designer precisa ler primeiro pra saber o que produzir. */}
        <div className="rounded-2xl border border-brand-400/25 bg-brand-500/[0.06] p-4">
          <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-brand-300">Descrição — o que produzir</div>
          <Textarea
            value={post.notes ?? ''}
            onChange={(e) => updatePost(postId, { notes: e.target.value })}
            placeholder="Roteiro, referências, texto da arte, hashtags… o que o designer precisa saber pra produzir."
            className="min-h-[100px] border-transparent bg-transparent px-0 focus:border-transparent focus:ring-0"
          />
        </div>

        <label className={cn(
          'flex cursor-pointer items-center gap-2.5 rounded-xl border px-3.5 py-2.5 text-sm transition',
          post.awaitingMaterial ? 'border-amber-400/40 bg-amber-500/10 text-amber-200' : 'border-line bg-white/[0.02] text-white/60',
        )}>
          <input type="checkbox" checked={Boolean(post.awaitingMaterial)}
            onChange={(e) => updatePost(postId, { awaitingMaterial: e.target.checked })}
            className="h-4 w-4 accent-amber-400" />
          <VideoOff size={15} className="shrink-0" />
          Pendência de gravação — falta o cliente mandar foto ou vídeo pra começar
        </label>

        {/* Trilha de etapas */}
        <div>
          <div className="mb-2 text-xs font-medium text-white/60">Etapa da produção</div>
          <div className="flex flex-wrap gap-1.5">
            {STAGE_ORDER.map((s) => {
              const active = s === post.stage;
              return (
                <button
                  key={s}
                  onClick={() => changeStage(s)}
                  className={cn('rounded-lg px-2.5 py-1.5 text-xs font-medium transition', !active && 'text-white/45 hover:text-white/80')}
                  style={active ? { background: `${STAGE_META[s].color}30`, color: STAGE_META[s].color, boxShadow: `inset 0 0 0 1px ${STAGE_META[s].color}` } : { background: 'rgba(255,255,255,0.04)' }}
                >
                  {STAGE_META[s].label}
                </button>
              );
            })}
          </div>
          <p className="mt-1.5 text-[11px] text-white/35">
            Ao mover para <b>Aprovação</b>, o app gera a copy e envia ao grupo do WhatsApp
            {whatsappReady ? '' : ' (simulado até conectar o webhook)'}.
          </p>
        </div>

        {/* Ações de aprovação */}
        {inApproval && (
          <div className="rounded-2xl border border-pink-500/30 bg-pink-500/[0.06] p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-medium text-pink-200">
              <Send size={15} /> Em aprovação
            </div>
            <p className="mb-3 text-xs text-white/55">
              Simule a resposta do grupo (ou deixe a automação do WhatsApp responder por você):
            </p>
            {!rejecting ? (
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => { void onApproved(postId); }}>
                  <Check size={16} /> Aprovado, publicar
                </Button>
                <Button variant="outline" onClick={() => setRejecting(true)}>
                  <X size={16} /> Pediu alteração
                </Button>
                <Button variant="outline" onClick={() => markPublishedManual(postId)} title="O cliente não respondeu e a equipe publicou por conta própria">
                  Publicamos manualmente
                </Button>
                <Button variant="ghost" onClick={() => { void sendForApproval(postId); }}>
                  <Send size={15} /> Reenviar ao grupo
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <Textarea
                  value={rejectText}
                  onChange={(e) => setRejectText(e.target.value)}
                  placeholder="O que precisa mudar? (vai para Alteração)"
                  autoFocus
                />
                <div className="flex gap-2">
                  <Button
                    variant="danger"
                    onClick={() => {
                      if (!rejectText.trim()) return;
                      onRejected(postId, rejectText.trim());
                      setRejectText('');
                      setRejecting(false);
                    }}
                  >
                    Enviar para alteração
                  </Button>
                  <Button variant="ghost" onClick={() => setRejecting(false)}>Cancelar</Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Pedidos de alteração */}
        {(inRevision || post.revisions.length > 0) && (
          <div className="rounded-2xl border border-line p-4">
            <RevisionList
              revisions={post.revisions}
              onAdd={(text) => addRevision(postId, text)}
              onToggle={(id) => {
                const r = post.revisions.find((x) => x.id === id);
                updateRevision(postId, id, { resolved: !r?.resolved });
              }}
              onRemove={(id) => removeRevision(postId, id)}
            />
            {inRevision && (
              <Button variant="soft" className="mt-3" onClick={() => changeStage('edicao')}>
                Reabrir para edição
              </Button>
            )}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Plataforma">
            <Select value={post.platform} onChange={(e) => updatePost(postId, { platform: e.target.value as PostPlatform })}>
              {PLATFORMS.map((p) => <option key={p}>{p}</option>)}
            </Select>
          </Field>
          <Field label="Cliente">
            <SearchSelect
              value={post.clientId ?? ''}
              onChange={(id) => updatePost(postId, { clientId: id || undefined })}
              options={clients.map((c) => ({ id: c.id, label: c.name, color: c.color }))}
              placeholder="Buscar cliente…"
            />
          </Field>
          <Field label="Responsável">
            <Select value={post.assigneeId ?? ''} onChange={(e) => updatePost(postId, { assigneeId: e.target.value || undefined })}>
              <option value="">—</option>
              {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </Select>
          </Field>
        </div>

        <Field label="Data prevista">
          <Input type="date" value={post.scheduledDate ?? ''} onChange={(e) => updatePost(postId, { scheduledDate: e.target.value || undefined })} />
        </Field>

        {/* Anexos */}
        <div>
          <div className="mb-1.5 text-xs font-medium text-white/60">Anexos (a primeira imagem é a capa do cartão)</div>
          <AttachmentsGallery items={anexos} onAdd={addAnexos} onRemove={removeAnexo} onMakeCover={makeCover} />
        </div>

        {/* Copy com IA */}
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-xs font-medium text-white/60">Copy da publicação</span>
            <div className="flex gap-1.5">
              {post.copy && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    navigator.clipboard?.writeText(post.copy || '');
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
                  }}
                >
                  <CopyIcon size={14} /> {copied ? 'Copiado' : 'Copiar'}
                </Button>
              )}
              <Button size="sm" variant="soft" onClick={genCopy} disabled={genLoading}>
                {genLoading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                Gerar com IA
              </Button>
            </div>
          </div>
          <Textarea
            value={post.copy ?? ''}
            onChange={(e) => updatePost(postId, { copy: e.target.value })}
            placeholder="Clique em “Gerar com IA” ou escreva a legenda aqui…"
            className="min-h-[120px]"
          />
        </div>

        <div className="flex items-center justify-between border-t border-line pt-4">
          <Button variant="danger" onClick={() => { removePost(postId); onClose(); }}>
            <Trash2 size={16} /> Excluir post
          </Button>
          <Button onClick={onClose}>Concluído</Button>
        </div>
      </div>
    </Modal>
  );
}
