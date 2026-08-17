import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors,
  useDraggable, useDroppable, pointerWithin,
  type DragStartEvent, type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, useSortable, horizontalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Plus, CheckSquare, MessageSquare, Link2, Clapperboard, Trash2, X, FolderOpen, Copy, ArrowRightCircle, GripVertical, ImageIcon } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { Button, Field, Input, Modal, Select } from '@/components/ui';
import { ContextMenu, type ContextMenuItem } from '@/components/ContextMenu';
import { useData } from '@/lib/dataStore';
import { useAuth } from '@/lib/authStore';
import { useSettings } from '@/lib/settingsStore';
import { useClientMap } from '@/lib/hooks';
import { VIDEO_STAGE_META, VIDEO_STAGE_ORDER, resolveOrder } from '@/lib/labels';
import { cn, todayISO } from '@/lib/utils';
import type { VideoProject, VideoStage } from '@/lib/types';
import { VideoModal } from '@/components/VideoModal';

export default function Videos() {
  const { videos, clients, addVideo, moveVideo, removeVideo } = useData();
  const clientMap = useClientMap();
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [form, setForm] = useState({ title: '', clientId: '', editor: '', dueDate: '' });

  // Seleção múltipla ao estilo Windows: Ctrl/Cmd+clique soma, Shift+clique
  // seleciona o intervalo dentro da mesma etapa. Clique simples limpa e abre.
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [lastClicked, setLastClicked] = useState<string | null>(null);
  const [bulkTarget, setBulkTarget] = useState<VideoStage>('briefing');

  // Seleção por arrasto (marquee) e menu de botão direito — igual em Posts.
  const [marquee, setMarquee] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; video: VideoProject } | null>(null);

  const savedStageOrder = useSettings((s) => s.videoStageOrder);
  const setStageOrder = useSettings((s) => s.update);
  const stageOrder = useMemo(() => resolveOrder(savedStageOrder, VIDEO_STAGE_ORDER), [savedStageOrder]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const byStage = useMemo(() => {
    const m: Record<string, VideoProject[]> = {};
    VIDEO_STAGE_ORDER.forEach((s) => (m[s] = []));
    videos.forEach((v) => (m[v.stage] ??= []).push(v));
    // Mesma lógica dos posts: por prazo, quem vence primeiro aparece
    // primeiro. Quem ainda não tem prazo sobe pro topo — é vídeo recém
    // criado, precisa de atenção antes de quem já tem data certa.
    for (const s of VIDEO_STAGE_ORDER) {
      m[s].sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''));
    }
    return m;
  }, [videos]);

  const activeVideo = activeId ? videos.find((v) => v.id === activeId) : null;
  const activeStage = activeId?.startsWith('col-') ? (activeId.slice(4) as VideoStage) : null;

  function onDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const { active, over } = e;
    if (!over) return;

    // Arrastou o cabeçalho da coluna — reordena as colunas.
    if (String(active.id).startsWith('col-')) {
      const overRaw = String(over.id);
      const fromStage = String(active.id).slice(4) as VideoStage;
      const toStage = (overRaw.startsWith('col-') ? overRaw.slice(4) : overRaw) as VideoStage;
      const from = stageOrder.indexOf(fromStage);
      const to = stageOrder.indexOf(toStage);
      if (from === -1 || to === -1 || from === to) return;
      setStageOrder({ videoStageOrder: arrayMove(stageOrder, from, to) });
      return;
    }

    const v = videos.find((x) => x.id === String(active.id));
    const toStage = String(over.id) as VideoStage;
    if (v && VIDEO_STAGE_ORDER.includes(toStage) && v.stage !== toStage) moveVideo(v.id, toStage);
  }

  /** Clica e arrasta numa área vazia da página pra selecionar vários vídeos de uma vez. */
  function onBoardMouseDown(e: MouseEvent) {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest('[data-video-id], [data-col-handle], button, textarea, input, select, a')) return;
    const additive = e.shiftKey || e.ctrlKey || e.metaKey;
    const x1 = e.clientX;
    let y1 = e.clientY;
    let x2 = x1, y2 = y1;
    setMarquee({ x1, y1, x2, y2 });

    // O canto onde o arrasto começou (y1) é um ponto fixo da PÁGINA, não da
    // tela — por isso ele tem que subir na tela conforme rola, senão o
    // retângulo fica "preso" num pedaço fixo enquanto o conteúdo passa por
    // baixo dele.
    const BORDA = 56;
    let velocidade = 0;
    let raf = 0;
    function passoScroll() {
      if (velocidade !== 0) {
        window.scrollBy(0, velocidade);
        y1 -= velocidade;
        setMarquee({ x1, y1, x2, y2 });
      }
      raf = requestAnimationFrame(passoScroll);
    }
    raf = requestAnimationFrame(passoScroll);

    function onMove(ev: MouseEvent) {
      x2 = ev.clientX; y2 = ev.clientY;
      setMarquee({ x1, y1, x2, y2 });
      if (ev.clientY < BORDA) velocidade = -Math.round((BORDA - ev.clientY) / 2) - 4;
      else if (ev.clientY > window.innerHeight - BORDA) velocidade = Math.round((ev.clientY - (window.innerHeight - BORDA)) / 2) + 4;
      else velocidade = 0;
    }
    function onUp() {
      cancelAnimationFrame(raf);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      const rect = { left: Math.min(x1, x2), right: Math.max(x1, x2), top: Math.min(y1, y2), bottom: Math.max(y1, y2) };
      if (rect.right - rect.left > 4 || rect.bottom - rect.top > 4) {
        const hits = new Set<string>();
        document.querySelectorAll('[data-video-id]').forEach((el) => {
          const r = el.getBoundingClientRect();
          if (r.left < rect.right && r.right > rect.left && r.top < rect.bottom && r.bottom > rect.top) {
            hits.add(el.getAttribute('data-video-id')!);
          }
        });
        setSelected((prev) => (additive ? new Set([...prev, ...hits]) : hits));
      }
      setMarquee(null);
    }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  useEffect(() => {
    document.addEventListener('mousedown', onBoardMouseDown);
    return () => document.removeEventListener('mousedown', onBoardMouseDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function contextItemsFor(video: VideoProject): ContextMenuItem[] {
    const outrasEtapas = stageOrder.filter((s) => s !== video.stage);
    return [
      { label: 'Abrir', icon: <FolderOpen size={15} />, onSelect: () => setOpenId(video.id) },
      {
        label: 'Duplicar',
        icon: <Copy size={15} />,
        onSelect: () => addVideo({ title: video.title + ' (cópia)', clientId: video.clientId, editor: video.editor, dueDate: video.dueDate, notes: video.notes }),
      },
      ...outrasEtapas.map((s) => ({
        label: `Mover para ${VIDEO_STAGE_META[s].label}`,
        icon: <ArrowRightCircle size={15} />,
        onSelect: () => moveVideo(video.id, s),
      })),
      { label: 'Excluir', icon: <Trash2 size={15} />, danger: true, onSelect: () => removeVideo(video.id) },
    ];
  }

  function handleCardClick(video: VideoProject, e: React.MouseEvent) {
    if (e.shiftKey && lastClicked) {
      const stageVideos = byStage[video.stage] || [];
      const a = stageVideos.findIndex((v) => v.id === lastClicked);
      const b = stageVideos.findIndex((v) => v.id === video.id);
      if (a !== -1 && b !== -1) {
        const [from, to] = a < b ? [a, b] : [b, a];
        setSelected((prev) => {
          const next = new Set(prev);
          stageVideos.slice(from, to + 1).forEach((v) => next.add(v.id));
          return next;
        });
        return;
      }
    }
    if (e.ctrlKey || e.metaKey) {
      setSelected((prev) => {
        const next = new Set(prev);
        if (next.has(video.id)) next.delete(video.id); else next.add(video.id);
        return next;
      });
      setLastClicked(video.id);
      return;
    }
    if (selected.size > 0) { setSelected(new Set()); return; }
    setOpenId(video.id);
  }

  function bulkMove() {
    selected.forEach((id) => {
      const v = videos.find((x) => x.id === id);
      if (v && v.stage !== bulkTarget) moveVideo(id, bulkTarget);
    });
    setSelected(new Set());
  }

  function bulkDelete() {
    if (!confirm(`Remover ${selected.size} vídeo(s) selecionado(s)?`)) return;
    selected.forEach((id) => removeVideo(id));
    setSelected(new Set());
  }

  function create() {
    if (!form.title.trim()) return;
    addVideo({ title: form.title.trim(), clientId: form.clientId || undefined, editor: form.editor || undefined, dueDate: form.dueDate || undefined });
    setForm({ title: '', clientId: '', editor: '', dueDate: '' });
    setCreating(false);
  }

  return (
    <div className="min-h-[calc(100vh-6rem)]">
      <PageHeader
        title="Edição de Vídeo"
        subtitle="Do briefing à entrega. Arraste os projetos entre as etapas, ou clique e arraste na área vazia pra selecionar vários."
        action={<Button onClick={() => setCreating(true)}><Plus size={18} /> Novo vídeo</Button>}
      />

      <DndContext sensors={sensors} collisionDetection={pointerWithin}
        onDragStart={(e: DragStartEvent) => setActiveId(String(e.active.id))} onDragEnd={onDragEnd}>
        <SortableContext items={stageOrder.map((s) => `col-${s}`)} strategy={horizontalListSortingStrategy}>
          <div className="board-row flex gap-4 overflow-x-auto pb-4">
            {stageOrder.map((stage) => (
              <VideoColumn key={stage} stage={stage} videos={byStage[stage] || []} clientMap={clientMap}
                selected={selected} onCardClick={handleCardClick}
                onCardContextMenu={(video, e) => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY, video }); }} />
            ))}
          </div>
        </SortableContext>
        <DragOverlay>
          {activeVideo ? <VideoCard video={activeVideo} clientMap={clientMap} dragging />
            : activeStage ? <div className="flex w-72 shrink-0 items-center gap-2 rounded-xl border border-brand-400/60 bg-ink-850 px-3 py-2.5 shadow-2xl"><span className="h-2.5 w-2.5 rounded-full" style={{ background: VIDEO_STAGE_META[activeStage].color }} /><span className="text-sm font-semibold text-white/90">{VIDEO_STAGE_META[activeStage].label}</span></div>
            : null}
        </DragOverlay>
      </DndContext>

      {marquee && createPortal(
        <div
          className="pointer-events-none fixed z-50 border border-brand-400/60 bg-brand-500/15"
          style={{
            left: Math.min(marquee.x1, marquee.x2), top: Math.min(marquee.y1, marquee.y2),
            width: Math.abs(marquee.x2 - marquee.x1), height: Math.abs(marquee.y2 - marquee.y1),
          }}
        />,
        document.body,
      )}

      {contextMenu && (
        <ContextMenu x={contextMenu.x} y={contextMenu.y} items={contextItemsFor(contextMenu.video)} onClose={() => setContextMenu(null)} />
      )}

      {openId && <VideoModal videoId={openId} onClose={() => setOpenId(null)} />}

      {selected.size > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-4">
          <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-brand-400/40 bg-ink-850/95 px-4 py-3 shadow-2xl backdrop-blur">
            <span className="text-sm text-white/80">{selected.size} selecionado(s)</span>
            <Select value={bulkTarget} onChange={(e) => setBulkTarget(e.target.value as VideoStage)} className="h-9 w-44">
              {VIDEO_STAGE_ORDER.map((s) => <option key={s} value={s}>{VIDEO_STAGE_META[s].label}</option>)}
            </Select>
            <Button size="sm" onClick={bulkMove}>Mover selecionados</Button>
            <Button size="sm" variant="danger" onClick={bulkDelete}><Trash2 size={14} /> Excluir</Button>
            <button onClick={() => setSelected(new Set())} className="grid h-8 w-8 place-items-center rounded-lg text-white/50 hover:bg-white/5 hover:text-white"><X size={16} /></button>
          </div>
        </div>
      )}

      <Modal open={creating} onClose={() => setCreating(false)} title="Novo vídeo"
        footer={<><Button variant="ghost" onClick={() => setCreating(false)}>Cancelar</Button><Button onClick={create}>Criar</Button></>}>
        <div className="space-y-4">
          <Field label="Título do vídeo">
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Ex.: VSL — Cliente X" autoFocus />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Cliente">
              <Select value={form.clientId} onChange={(e) => setForm({ ...form, clientId: e.target.value })}>
                <option value="">—</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </Field>
            <Field label="Editor(a)">
              <Input value={form.editor} onChange={(e) => setForm({ ...form, editor: e.target.value })} placeholder="Ex.: Bruno" />
            </Field>
          </div>
          <Field label="Prazo">
            <Input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
          </Field>
        </div>
      </Modal>
    </div>
  );
}

function VideoColumn({ stage, videos, clientMap, selected, onCardClick, onCardContextMenu }: {
  stage: VideoStage; videos: VideoProject[]; clientMap: ReturnType<typeof useClientMap>;
  selected: Set<string>; onCardClick: (video: VideoProject, e: React.MouseEvent) => void;
  onCardContextMenu: (video: VideoProject, e: React.MouseEvent) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  const {
    setNodeRef: setColRef, attributes, listeners, transform, transition, isDragging,
  } = useSortable({ id: `col-${stage}` });
  const meta = VIDEO_STAGE_META[stage];
  return (
    <div
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
      className="flex w-72 shrink-0 flex-col"
    >
      <div ref={setColRef} {...attributes} {...listeners} data-col-handle className="mb-2 flex cursor-grab items-center gap-2 px-1 active:cursor-grabbing">
        <GripVertical size={14} className="text-white/20" />
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: meta.color }} />
        <span className="text-sm font-semibold text-white/85">{meta.label}</span>
        <span className="rounded-full bg-white/10 px-2 text-xs text-white/50">{videos.length}</span>
      </div>
      <div ref={setNodeRef} className={cn('flex min-h-[120px] flex-1 flex-col gap-2 rounded-2xl border border-line/60 bg-ink-900/40 p-2 transition', isOver && 'border-brand-400/60 bg-brand-500/10')}>
        {videos.map((v) => (
          <DraggableVideo key={v.id} video={v} clientMap={clientMap}
            isSelected={selected.has(v.id)} onClick={(e) => onCardClick(v, e)}
            onContextMenu={(e) => onCardContextMenu(v, e)} />
        ))}
        {videos.length === 0 && <div className="grid flex-1 place-items-center py-6 text-xs text-white/25">Solte aqui</div>}
      </div>
    </div>
  );
}

function DraggableVideo({ video, onClick, onContextMenu, clientMap, isSelected }: {
  video: VideoProject; onClick: (e: React.MouseEvent) => void; onContextMenu: (e: React.MouseEvent) => void; clientMap: ReturnType<typeof useClientMap>; isSelected: boolean;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: video.id });
  return (
    <div ref={setNodeRef} style={{ opacity: isDragging ? 0.4 : 1 }} {...attributes} {...listeners} data-video-id={video.id} onClick={onClick} onContextMenu={onContextMenu}>
      <VideoCard video={video} clientMap={clientMap} selected={isSelected} />
    </div>
  );
}

function VideoCard({ video, clientMap, dragging, selected }: {
  video: VideoProject; clientMap: ReturnType<typeof useClientMap>; dragging?: boolean; selected?: boolean;
}) {
  const client = video.clientId ? clientMap[video.clientId] : undefined;
  const assignee = useAuth((s) => (video.assigneeId ? s.accounts.find((a) => a.id === video.assigneeId) : undefined));
  const done = video.checklist.filter((c) => c.done).length;
  const pendRev = video.revisions.filter((r) => !r.resolved).length;
  const late = video.dueDate && video.dueDate < todayISO() && video.stage !== 'entregue';
  return (
    <div className={cn(
      'cursor-pointer touch-none select-none rounded-lg border border-line bg-ink-850 p-3 transition hover:border-white/20',
      dragging && 'rotate-2 border-brand-400/60 shadow-2xl',
      selected && 'border-brand-400/70 ring-2 ring-brand-400/50',
    )}>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1 text-left">
          <div className="flex items-center gap-1.5 text-brand-300"><Clapperboard size={13} /><span className="text-[11px] text-white/40">{assignee?.name || video.editor || 'sem responsável'}</span></div>
          <p className="mt-1 line-clamp-2 text-sm leading-snug text-white/90">{video.title}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-white/45">
            {client && <span className="inline-flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full" style={{ background: client.color }} />{client.name}</span>}
            {video.links.length > 0 && <span className="inline-flex items-center gap-1"><Link2 size={11} /> {video.links.length}</span>}
            {video.mediaUrl && <span className="inline-flex items-center gap-1 text-brand-300" title="Tem imagem anexada"><ImageIcon size={11} /></span>}
            {video.checklist.length > 0 && <span className="inline-flex items-center gap-1"><CheckSquare size={11} /> {done}/{video.checklist.length}</span>}
            {pendRev > 0 && <span className="inline-flex items-center gap-1 text-rose-300"><MessageSquare size={11} /> {pendRev}</span>}
            {video.dueDate && <span className={cn('ml-auto', late && 'text-red-300')}>{new Date(video.dueDate + 'T00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
