import { useRef, useState } from 'react';
import { Trash2, Plus, X, Check, Link2, ExternalLink } from 'lucide-react';
import { Modal, Button, Field, Input, Textarea, Select } from './ui';
import { RevisionList } from './RevisionList';
import { useData } from '@/lib/dataStore';
import { useAuth } from '@/lib/authStore';
import { VIDEO_STAGE_META, VIDEO_STAGE_ORDER } from '@/lib/labels';
import { uid, cn } from '@/lib/utils';

export function VideoModal({ videoId, onClose }: { videoId: string; onClose: () => void }) {
  const video = useData((s) => s.videos.find((v) => v.id === videoId));
  const clients = useData((s) => s.clients);
  const members = useAuth((s) => s.accounts);
  const update = useData((s) => s.updateVideo);
  const remove = useData((s) => s.removeVideo);
  const move = useData((s) => s.moveVideo);
  const addLink = useData((s) => s.addVideoLink);
  const removeLink = useData((s) => s.removeVideoLink);
  const addRev = useData((s) => s.addVideoRevision);
  const toggleRev = useData((s) => s.toggleVideoRevision);
  const [ck, setCk] = useState('');
  const [linkLabel, setLinkLabel] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  if (!video) return null;

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => update(videoId, { mediaUrl: String(reader.result) });
    reader.readAsDataURL(f);
  }

  return (
    <Modal open onClose={onClose} wide title="Projeto de vídeo">
      <div className="space-y-5">
        <Field label="Título"><Input value={video.title} onChange={(e) => update(videoId, { title: e.target.value })} /></Field>

        <div>
          <div className="mb-2 text-xs font-medium text-white/60">Etapa</div>
          <div className="flex flex-wrap gap-1.5">
            {VIDEO_STAGE_ORDER.map((s) => {
              const active = s === video.stage;
              return (
                <button key={s} onClick={() => move(videoId, s)}
                  className={cn('rounded-lg px-2.5 py-1.5 text-xs font-medium transition', !active && 'text-white/45 hover:text-white/80')}
                  style={active ? { background: `${VIDEO_STAGE_META[s].color}30`, color: VIDEO_STAGE_META[s].color, boxShadow: `inset 0 0 0 1px ${VIDEO_STAGE_META[s].color}` } : { background: 'rgba(255,255,255,0.04)' }}>
                  {VIDEO_STAGE_META[s].label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Cliente">
            <Select value={video.clientId ?? ''} onChange={(e) => update(videoId, { clientId: e.target.value || undefined })}>
              <option value="">—</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </Field>
          <Field label="Responsável">
            <Select value={video.assigneeId ?? ''} onChange={(e) => update(videoId, { assigneeId: e.target.value || undefined })}>
              <option value="">—</option>
              {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </Select>
          </Field>
          <Field label="Prazo"><Input type="date" value={video.dueDate ?? ''} onChange={(e) => update(videoId, { dueDate: e.target.value || undefined })} /></Field>
        </div>

        {/* Mídia de referência */}
        <div>
          <div className="mb-1.5 text-xs font-medium text-white/60">Imagem de referência (capa, print, frame de exemplo)</div>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={onFile} />
          {video.mediaUrl ? (
            <div className="relative w-fit">
              <img src={video.mediaUrl} alt="" className="max-h-48 rounded-xl border border-line" />
              <button
                onClick={() => update(videoId, { mediaUrl: undefined })}
                className="absolute -right-2 -top-2 grid h-7 w-7 place-items-center rounded-full bg-ink-800 text-white/70 ring-1 ring-line hover:text-red-300"
              >
                <X size={14} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => fileRef.current?.click()}
              className="flex items-center gap-2 rounded-xl border border-dashed border-line px-4 py-3 text-sm text-white/50 hover:border-brand-400/50 hover:text-white"
            >
              <Plus size={16} /> Anexar imagem
            </button>
          )}
        </div>

        {/* Links */}
        <div>
          <div className="mb-2 text-xs font-medium text-white/60">Links (bruto, versões, referências)</div>
          <div className="space-y-1.5">
            {video.links.map((l) => (
              <div key={l.id} className="group flex items-center gap-2 rounded-lg border border-line bg-white/[0.02] px-3 py-2">
                <Link2 size={14} className="text-brand-300" />
                <span className="text-sm text-white/80">{l.label}</span>
                <a href={l.url} target="_blank" rel="noreferrer" className="ml-auto text-brand-300 hover:text-brand-200"><ExternalLink size={14} /></a>
                <button onClick={() => removeLink(videoId, l.id)} className="text-white/20 opacity-0 transition hover:text-red-300 group-hover:opacity-100"><X size={14} /></button>
              </div>
            ))}
          </div>
          <div className="mt-2 grid grid-cols-[1fr_1fr_auto] gap-2">
            <Input value={linkLabel} onChange={(e) => setLinkLabel(e.target.value)} placeholder="Rótulo" />
            <Input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://…" />
            <Button variant="outline" onClick={() => { if (linkLabel.trim() && linkUrl.trim()) { addLink(videoId, { label: linkLabel.trim(), url: linkUrl.trim() }); setLinkLabel(''); setLinkUrl(''); } }}><Plus size={16} /></Button>
          </div>
        </div>

        {/* Checklist */}
        <div>
          <div className="mb-2 text-xs font-medium text-white/60">Checklist</div>
          <div className="space-y-1.5">
            {video.checklist.map((item) => (
              <div key={item.id} className="group flex items-center gap-2.5">
                <button onClick={() => update(videoId, { checklist: video.checklist.map((c) => c.id === item.id ? { ...c, done: !c.done } : c) })}
                  className={cn('grid h-5 w-5 shrink-0 place-items-center rounded-md border transition', item.done ? 'border-brand-400 bg-brand-500 text-white' : 'border-line text-transparent hover:border-brand-400')}>
                  <Check size={13} />
                </button>
                <span className={cn('flex-1 text-sm', item.done ? 'text-white/40 line-through' : 'text-white/85')}>{item.text}</span>
                <button onClick={() => update(videoId, { checklist: video.checklist.filter((c) => c.id !== item.id) })} className="text-white/20 opacity-0 transition hover:text-red-300 group-hover:opacity-100"><X size={14} /></button>
              </div>
            ))}
          </div>
          <div className="mt-2 flex gap-2">
            <Input value={ck} onChange={(e) => setCk(e.target.value)} placeholder="Adicionar item…"
              onKeyDown={(e) => { if (e.key === 'Enter' && ck.trim()) { update(videoId, { checklist: [...video.checklist, { id: uid('ck'), text: ck.trim(), done: false }] }); setCk(''); } }} />
            <Button variant="outline" onClick={() => { if (ck.trim()) { update(videoId, { checklist: [...video.checklist, { id: uid('ck'), text: ck.trim(), done: false }] }); setCk(''); } }}><Plus size={16} /></Button>
          </div>
        </div>

        {/* Alterações */}
        <div className="rounded-2xl border border-line p-4">
          <RevisionList revisions={video.revisions} onAdd={(t) => addRev(videoId, t)} onToggle={(id) => toggleRev(videoId, id)} />
        </div>

        <Field label="Observações"><Textarea value={video.notes ?? ''} onChange={(e) => update(videoId, { notes: e.target.value })} /></Field>

        <div className="flex items-center justify-between border-t border-line pt-4">
          <Button variant="danger" onClick={() => { remove(videoId); onClose(); }}><Trash2 size={16} /> Excluir</Button>
          <Button onClick={onClose}>Concluído</Button>
        </div>
      </div>
    </Modal>
  );
}
