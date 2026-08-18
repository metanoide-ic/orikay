import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { createPortal } from 'react-dom';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  closestCorners,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy, horizontalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Plus, CheckSquare, MessageSquare, AlertTriangle, LayoutGrid, CalendarDays, X, VideoOff, Trash2,
  FolderOpen, Copy, Clapperboard, ArrowRightCircle, GripVertical, ImageIcon, ImageUp, Link2,
  CalendarClock, Archive, ArchiveRestore,
} from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { ClientFilter } from '@/components/ClientFilter';
import { Button, Badge, Avatar, Select } from '@/components/ui';
import { PostsCalendar } from '@/components/PostsCalendar';
import { ContextMenu, type ContextMenuItem } from '@/components/ContextMenu';
import { useData } from '@/lib/dataStore';
import { useAuth } from '@/lib/authStore';
import { useSettings } from '@/lib/settingsStore';
import { useClientMap } from '@/lib/hooks';
import { STAGE_META, STAGE_ORDER, STAGE_FUNNEL, PLATFORM_COLOR, resolveOrder } from '@/lib/labels';
import { onPostStageChange } from '@/lib/automations';
import { cn, todayISO, coverOf } from '@/lib/utils';
import type { Post, PostStage } from '@/lib/types';
import { PostModal } from '@/components/PostModal';

export default function Posts() {
  const { posts, clients, movePost, removePost, updatePost, addPost } = useData();
  const clientMap = useClientMap();
  const savedStageOrder = useSettings((s) => s.postStageOrder);
  const setStageOrder = useSettings((s) => s.update);
  const [openId, setOpenId] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [view, setView] = useState<'pipeline' | 'calendario'>('pipeline');
  const [clientFilter, setClientFilter] = useState<string>('');
  const [showArchived, setShowArchived] = useState(false);
  const [toast, setToast] = useState('');
  const [searchParams, setSearchParams] = useSearchParams();

  // Link direto ("Copiar link" do menu) abre o cartão certo assim que a
  // página carrega, e limpa o parâmetro da URL pra não reabrir de novo.
  useEffect(() => {
    const id = searchParams.get('open');
    if (id) {
      setOpenId(id);
      const next = new URLSearchParams(searchParams);
      next.delete('open');
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function avisar(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 2000);
  }

  // Alterar capa e Editar data direto pelo menu de botão direito, sem abrir
  // o cartão inteiro — inputs escondidos disparados pelo item do menu.
  const capaFileRef = useRef<HTMLInputElement>(null);
  const [capaTargetId, setCapaTargetId] = useState<string | null>(null);
  const dateInputRef = useRef<HTMLInputElement>(null);
  const [dateTargetId, setDateTargetId] = useState<string | null>(null);

  function onCapaFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f || !capaTargetId) return;
    const reader = new FileReader();
    reader.onload = () => {
      const p = posts.find((x) => x.id === capaTargetId);
      const resto = (p?.mediaUrls ?? (p?.mediaUrl ? [p.mediaUrl] : [])).filter((u) => u !== undefined);
      updatePost(capaTargetId, { mediaUrls: [String(reader.result), ...resto], mediaUrl: undefined });
    };
    reader.readAsDataURL(f);
  }

  // As colunas podem ser arrastadas de lugar (o usuário decide a ordem que
  // faz mais sentido pra rotina dele) — fica salvo por navegador.
  const stageOrder = useMemo(() => resolveOrder(savedStageOrder, STAGE_ORDER), [savedStageOrder]);

  // Seleção múltipla ao estilo Windows: Ctrl/Cmd+clique soma um, Shift+clique
  // seleciona o intervalo dentro da mesma lista. Clique simples limpa a seleção.
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [lastClicked, setLastClicked] = useState<string | null>(null);
  const [bulkTarget, setBulkTarget] = useState<PostStage>('ideia');

  // Seleção por arrasto (marquee), igual selecionar ícones na área de trabalho.
  const [marquee, setMarquee] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
  // Menu de botão direito num card específico.
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; post: Post } | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const naoArquivados = useMemo(() => posts.filter((p) => !p.archived), [posts]);
  const arquivados = useMemo(() => posts.filter((p) => p.archived), [posts]);
  const visible = useMemo(
    () => (clientFilter ? naoArquivados.filter((p) => p.clientId === clientFilter) : naoArquivados),
    [naoArquivados, clientFilter],
  );

  const byStage = useMemo(() => {
    const m: Record<string, Post[]> = {};
    STAGE_ORDER.forEach((s) => (m[s] = []));
    visible.forEach((p) => (m[p.stage] ??= []).push(p));
    // Dentro de cada coluna, em ordem de data de publicação — quem vem antes
    // na fila é o que o designer precisa fazer primeiro. Quem ainda não tem
    // data (cartão recém-criado, só uma ideia solta) sobe pro topo — precisa
    // de atenção (dar uma data) antes de quem já tem prazo certo.
    for (const s of STAGE_ORDER) {
      m[s].sort((a, b) => (a.scheduledDate || '').localeCompare(b.scheduledDate || ''));
    }
    return m;
  }, [visible]);

  const activePost = activeId ? posts.find((p) => p.id === activeId) : null;
  const activeStage = activeId?.startsWith('col-') ? (activeId.slice(4) as PostStage) : null;

  function handleCardClick(post: Post, e: React.MouseEvent) {
    if (e.shiftKey && lastClicked) {
      const stagePosts = byStage[post.stage] || [];
      const a = stagePosts.findIndex((p) => p.id === lastClicked);
      const b = stagePosts.findIndex((p) => p.id === post.id);
      if (a !== -1 && b !== -1) {
        const [from, to] = a < b ? [a, b] : [b, a];
        setSelected((prev) => {
          const next = new Set(prev);
          stagePosts.slice(from, to + 1).forEach((p) => next.add(p.id));
          return next;
        });
        return;
      }
    }
    if (e.ctrlKey || e.metaKey) {
      setSelected((prev) => {
        const next = new Set(prev);
        if (next.has(post.id)) next.delete(post.id); else next.add(post.id);
        return next;
      });
      setLastClicked(post.id);
      return;
    }
    if (selected.size > 0) { setSelected(new Set()); return; }
    setOpenId(post.id);
  }

  function bulkMove() {
    selected.forEach((id) => {
      const p = posts.find((x) => x.id === id);
      if (!p || p.stage === bulkTarget) return;
      movePost(id, bulkTarget, (byStage[bulkTarget] || []).length);
      onPostStageChange(id, p.stage, bulkTarget);
    });
    setSelected(new Set());
  }

  function bulkDelete() {
    if (!confirm(`Remover ${selected.size} post(s) selecionado(s)?`)) return;
    selected.forEach((id) => removePost(id));
    setSelected(new Set());
  }

  /**
   * Clica e arrasta numa área vazia da página pra selecionar vários cards de
   * uma vez — igual selecionar ícones na área de trabalho do Windows. Fica no
   * elemento mais de fora (a página toda), não só na faixa das colunas, pra
   * funcionar mesmo começando na margem, do lado esquerdo da primeira coluna
   * ou em qualquer espaço vazio.
   */
  function onBoardMouseDown(e: MouseEvent) {
    if (view !== 'pipeline') return; // só faz sentido no quadro, não no calendário
    if (e.button !== 0) return; // só botão esquerdo
    const target = e.target as HTMLElement;
    if (target.closest('[data-post-id], [data-col-handle], button, textarea, input, select, a')) return;
    const additive = e.shiftKey || e.ctrlKey || e.metaKey;
    const x1 = e.clientX;
    let y1 = e.clientY;
    let x2 = x1, y2 = y1;
    setMarquee({ x1, y1, x2, y2 });

    // Auto-scroll: se o mouse fica perto da borda da tela enquanto arrasta,
    // rola a página sozinha, pra dar pra alcançar os cards mais abaixo sem
    // ficar "preso" no que já está visível. O canto onde o arrasto começou
    // (y1) é um ponto fixo da PÁGINA, não da tela — por isso ele tem que
    // subir na tela conforme rola, senão o retângulo fica "preso" num
    // pedaço fixo enquanto o conteúdo passa por baixo dele.
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
      // Só conta como arrasto de verdade — um clique parado não deve mexer na seleção.
      if (rect.right - rect.left > 4 || rect.bottom - rect.top > 4) {
        const hits = new Set<string>();
        document.querySelectorAll('[data-post-id]').forEach((el) => {
          const r = el.getBoundingClientRect();
          if (r.left < rect.right && r.right > rect.left && r.top < rect.bottom && r.bottom > rect.top) {
            hits.add(el.getAttribute('data-post-id')!);
          }
        });
        setSelected((prev) => (additive ? new Set([...prev, ...hits]) : hits));
      }
      setMarquee(null);
    }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  // Escuta o clique-e-arrasta na página inteira (não só na faixa das
  // colunas) — assim começar o arrasto na margem, do lado esquerdo da
  // primeira coluna ou em qualquer espaço vazio da tela funciona igual.
  useEffect(() => {
    document.addEventListener('mousedown', onBoardMouseDown);
    return () => document.removeEventListener('mousedown', onBoardMouseDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  function contextItemsFor(post: Post): ContextMenuItem[] {
    const outrasEtapas = stageOrder.filter((s) => s !== post.stage);
    return [
      { label: 'Abrir cartão', icon: <FolderOpen size={15} />, onSelect: () => setOpenId(post.id) },
      {
        label: 'Alterar capa',
        icon: <ImageUp size={15} />,
        onSelect: () => { setCapaTargetId(post.id); setTimeout(() => capaFileRef.current?.click(), 0); },
      },
      {
        label: 'Editar data',
        icon: <CalendarClock size={15} />,
        onSelect: () => {
          setDateTargetId(post.id);
          setTimeout(() => {
            const el = dateInputRef.current as (HTMLInputElement & { showPicker?: () => void }) | null;
            if (!el) return;
            el.value = post.scheduledDate ?? '';
            if (typeof el.showPicker === 'function') el.showPicker();
            else el.click();
          }, 0);
        },
      },
      {
        label: 'Copiar link',
        icon: <Link2 size={15} />,
        onSelect: () => {
          const url = `${location.origin}${location.pathname}#/app/posts?open=${post.id}`;
          navigator.clipboard?.writeText(url);
          avisar('Link copiado — quem abrir vai direto nesse cartão.');
        },
      },
      {
        label: post.awaitingMaterial ? 'Desmarcar pendência de gravação' : 'Marcar pendência de gravação',
        icon: <Clapperboard size={15} />,
        onSelect: () => updatePost(post.id, { awaitingMaterial: !post.awaitingMaterial }),
      },
      {
        label: 'Duplicar cartão',
        icon: <Copy size={15} />,
        onSelect: () => addPost({
          title: post.title + ' (cópia)', platform: post.platform, clientId: post.clientId,
          stage: post.stage, scheduledDate: post.scheduledDate, caption: post.caption, copy: post.copy,
          notes: post.notes, awaitingMaterial: post.awaitingMaterial, mediaUrls: post.mediaUrls,
        }),
      },
      ...outrasEtapas.map((s) => ({
        label: `Mover para ${STAGE_META[s].label}`,
        icon: <ArrowRightCircle size={15} />,
        onSelect: () => {
          movePost(post.id, s, (byStage[s] || []).length);
          onPostStageChange(post.id, post.stage, s);
        },
      })),
      {
        label: 'Arquivar',
        icon: <Archive size={15} />,
        onSelect: () => { updatePost(post.id, { archived: true }); avisar('Cartão arquivado.'); },
      },
      { label: 'Excluir', icon: <Trash2 size={15} />, danger: true, onSelect: () => removePost(post.id) },
    ];
  }

  function stageOf(id: string): PostStage | undefined {
    if ((STAGE_ORDER as string[]).includes(id)) return id as PostStage;
    return posts.find((p) => p.id === id)?.stage;
  }

  function onDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const { active, over } = e;
    if (!over) return;

    // Arrastou a própria coluna (o cabeçalho) — reordena as colunas, não os cards.
    // O alvo pode chegar com ou sem o prefixo "col-" (a área de cartões da
    // coluna de destino usa o id puro do estágio) — aceita os dois formatos.
    if (String(active.id).startsWith('col-')) {
      const overRaw = String(over.id);
      const fromStage = String(active.id).slice(4) as PostStage;
      const toStage = (overRaw.startsWith('col-') ? overRaw.slice(4) : overRaw) as PostStage;
      const from = stageOrder.indexOf(fromStage);
      const to = stageOrder.indexOf(toStage);
      if (from === -1 || to === -1 || from === to) return;
      setStageOrder({ postStageOrder: arrayMove(stageOrder, from, to) });
      return;
    }

    const post = posts.find((p) => p.id === String(active.id));
    const toStage = stageOf(String(over.id));
    if (!post || !toStage) return;

    const targetIds = (byStage[toStage] || []).filter((p) => p.id !== post.id).map((p) => p.id);
    let index = targetIds.indexOf(String(over.id));
    if (index === -1) index = targetIds.length;
    movePost(post.id, toStage, index);
    if (post.stage !== toStage) onPostStageChange(post.id, post.stage, toStage);
  }

  return (
    <div className="min-h-[calc(100vh-6rem)]">
      <PageHeader
        title="Posts"
        subtitle="Arraste os cartões entre as listas. Ao chegar em Aprovação, a copy vai para o grupo."
        action={
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg border border-line p-0.5">
              <button onClick={() => setView('pipeline')} className={cn('flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium transition', view === 'pipeline' ? 'bg-brand-500/20 text-brand-100' : 'text-white/50 hover:text-white')}>
                <LayoutGrid size={15} /> Quadro
              </button>
              <button onClick={() => setView('calendario')} className={cn('flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium transition', view === 'calendario' ? 'bg-brand-500/20 text-brand-100' : 'text-white/50 hover:text-white')}>
                <CalendarDays size={15} /> Calendário
              </button>
            </div>
          </div>
        }
      />

      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <ClientFilter clients={clients} value={clientFilter} onChange={setClientFilter} />
        {arquivados.length > 0 && (
          <button onClick={() => setShowArchived((v) => !v)} className="flex items-center gap-1.5 text-xs font-medium text-white/45 hover:text-white">
            <Archive size={13} /> {showArchived ? 'Voltar ao quadro' : `Ver arquivados (${arquivados.length})`}
          </button>
        )}
      </div>

      {showArchived ? (
        <div className="space-y-1.5">
          {arquivados.map((p) => (
            <div key={p.id} className="flex items-center gap-3 rounded-lg border border-line bg-ink-850 px-3.5 py-2.5">
              <span className="min-w-0 flex-1 truncate text-sm text-white/75">{p.title}</span>
              <Button size="sm" variant="outline" onClick={() => updatePost(p.id, { archived: false })}>
                <ArchiveRestore size={14} /> Desarquivar
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setOpenId(p.id)}>Abrir</Button>
            </div>
          ))}
        </div>
      ) : view === 'calendario' ? (
        <PostsCalendar posts={visible} onOpen={setOpenId} />
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCorners}
          onDragStart={(e: DragStartEvent) => setActiveId(String(e.active.id))} onDragEnd={onDragEnd}>
          <SortableContext items={stageOrder.map((s) => `col-${s}`)} strategy={horizontalListSortingStrategy}>
            <div className="board-row flex gap-3 overflow-x-auto pb-4">
              {stageOrder.map((stage) => (
                <StageList key={stage} stage={stage} posts={byStage[stage] || []} clientMap={clientMap}
                  selected={selected} onCardClick={handleCardClick}
                  onCardContextMenu={(post, e) => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY, post }); }} />
              ))}
            </div>
          </SortableContext>
          <DragOverlay>
            {activePost ? <PostCard post={activePost} clientMap={clientMap} dragging />
              : activeStage ? <div className="flex w-[300px] shrink-0 items-center gap-2 rounded-xl border border-brand-400/60 bg-ink-850 px-3 py-2.5 shadow-2xl"><span className="h-2.5 w-2.5 rounded-full" style={{ background: STAGE_META[activeStage].color }} /><span className="text-sm font-semibold text-white/90">{STAGE_META[activeStage].label}</span></div>
              : null}
          </DragOverlay>
        </DndContext>
      )}

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
        <ContextMenu x={contextMenu.x} y={contextMenu.y} items={contextItemsFor(contextMenu.post)} onClose={() => setContextMenu(null)} />
      )}

      {openId && <PostModal postId={openId} onClose={() => setOpenId(null)} />}

      {/* Inputs escondidos usados pelo menu de botão direito (alterar capa / editar data). */}
      <input ref={capaFileRef} type="file" accept="image/*" hidden onChange={onCapaFile} />
      <input
        ref={dateInputRef}
        type="date"
        className="sr-only"
        onChange={(e) => { if (dateTargetId) updatePost(dateTargetId, { scheduledDate: e.target.value || undefined }); }}
      />

      {toast && (
        <div className="fixed bottom-5 left-1/2 z-[70] -translate-x-1/2 rounded-xl border border-line bg-ink-850 px-4 py-2.5 text-sm text-white/85 shadow-2xl">
          {toast}
        </div>
      )}

      {selected.size > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-4">
          <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-brand-400/40 bg-ink-850/95 px-4 py-3 shadow-2xl backdrop-blur">
            <span className="text-sm text-white/80">{selected.size} selecionado(s)</span>
            <Select value={bulkTarget} onChange={(e) => setBulkTarget(e.target.value as PostStage)} className="h-9 w-44">
              {STAGE_ORDER.map((s) => <option key={s} value={s}>{STAGE_META[s].label}</option>)}
            </Select>
            <Button size="sm" onClick={bulkMove}>Mover selecionados</Button>
            <Button size="sm" variant="danger" onClick={bulkDelete}><Trash2 size={14} /> Excluir</Button>
            <button onClick={() => setSelected(new Set())} className="grid h-8 w-8 place-items-center rounded-lg text-white/50 hover:bg-white/5 hover:text-white"><X size={16} /></button>
          </div>
        </div>
      )}
    </div>
  );
}
// (Criação agora é feita direto em cada lista, no estilo Trello.)

function StageList({
  stage, posts, clientMap, selected, onCardClick, onCardContextMenu,
}: {
  stage: PostStage;
  posts: Post[];
  clientMap: ReturnType<typeof useClientMap>;
  selected: Set<string>;
  onCardClick: (post: Post, e: React.MouseEvent) => void;
  onCardContextMenu: (post: Post, e: React.MouseEvent) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  const {
    setNodeRef: setColRef, attributes, listeners, transform, transition, isDragging,
  } = useSortable({ id: `col-${stage}` });
  const addPost = useData((s) => s.addPost);
  const meta = STAGE_META[stage];
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState('');

  function add() {
    if (!title.trim()) return;
    // Sem data: um cartão criado rápido assim é uma ideia solta, ainda sem
    // prazo — por isso ele sobe pro topo da lista (quem não tem data vem
    // primeiro), em vez de cair em algum lugar no meio da fila por data.
    addPost({ title: title.trim(), platform: 'Instagram', stage });
    setTitle('');
  }

  return (
    <div
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
      className="flex w-[300px] shrink-0 flex-col rounded-xl border border-line bg-ink-900/60"
    >
      {/*
        O "pegador" da coluna é só o cabeçalho — de propósito não é o cartão
        inteiro, porque senão a área de arrastar coluna ficaria por cima da
        área de soltar cartão (mesmo espaço, dois alvos), e o dnd-kit não
        saberia pra qual dos dois resolver o drop.
      */}
      <div ref={setColRef} {...attributes} {...listeners} data-col-handle className="flex cursor-grab items-center gap-2 px-3 py-2.5 active:cursor-grabbing">
        <GripVertical size={14} className="text-white/20" />
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: meta.color }} />
        <span className="text-sm font-semibold text-white/90">{meta.label}</span>
        <span className="rounded-full bg-white/10 px-2 text-xs text-white/50">{posts.length}</span>
      </div>

      {/* Adicionar cartão fica no topo — igual em qualquer app de anotação
          rápida, o que você acabou de criar tem que aparecer na hora, sem
          precisar procurar lá embaixo numa lista de centenas de cartões. */}
      <div className="p-2 pb-0">
        {adding ? (
          <div className="rounded-lg border border-line bg-ink-850 p-2">
            <textarea value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título do cartão…" autoFocus rows={2}
              className="w-full resize-none bg-transparent text-sm text-white placeholder:text-white/30 outline-none"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); add(); }
                if (e.key === 'Escape') setAdding(false);
              }} />
            <div className="mt-2 flex gap-2">
              <Button size="sm" onClick={add}>Adicionar cartão</Button>
              <button onClick={() => { setAdding(false); setTitle(''); }} className="grid h-8 w-8 place-items-center rounded-lg text-white/50 hover:bg-white/5 hover:text-white"><X size={16} /></button>
            </div>
          </div>
        ) : (
          <button onClick={() => setAdding(true)} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-white/45 transition hover:bg-white/5 hover:text-white">
            <Plus size={15} /> Adicionar cartão
          </button>
        )}
      </div>

      <div ref={setNodeRef} className={cn('flex-1 space-y-2 p-2 transition', isOver && 'bg-brand-500/[0.06]')}>
        <SortableContext items={posts.map((p) => p.id)} strategy={verticalListSortingStrategy}>
          {posts.map((p) => (
            <SortablePost key={p.id} post={p} clientMap={clientMap}
              isSelected={selected.has(p.id)} onClick={(e) => onCardClick(p, e)}
              onContextMenu={(e) => onCardContextMenu(p, e)} />
          ))}
        </SortableContext>
        {posts.length === 0 && <div className="grid h-16 place-items-center rounded-lg text-xs text-white/25">Solte um cartão aqui</div>}
      </div>
    </div>
  );
}

function SortablePost({ post, onClick, onContextMenu, clientMap, isSelected }: {
  post: Post; onClick: (e: React.MouseEvent) => void; onContextMenu: (e: React.MouseEvent) => void;
  clientMap: ReturnType<typeof useClientMap>; isSelected: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: post.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 };
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} data-post-id={post.id} onClick={onClick} onContextMenu={onContextMenu}>
      <PostCard post={post} clientMap={clientMap} selected={isSelected} />
    </div>
  );
}

function PostCard({ post, clientMap, dragging, selected }: {
  post: Post; clientMap: ReturnType<typeof useClientMap>; dragging?: boolean; selected?: boolean;
}) {
  const client = post.clientId ? clientMap[post.clientId] : undefined;
  const assignee = useAuth((s) => (post.assigneeId ? s.accounts.find((a) => a.id === post.assigneeId) : undefined));
  const done = post.checklist.filter((c) => c.done).length;
  const pendRev = post.revisions.filter((r) => !r.resolved).length;
  const funnelIdx = STAGE_FUNNEL.indexOf(post.stage);
  const progress = funnelIdx >= 0 ? Math.round(((funnelIdx + 1) / STAGE_FUNNEL.length) * 100) : 50;
  const today = todayISO();
  const late = post.scheduledDate && post.scheduledDate < today && post.stage !== 'publicado';
  const dueToday = post.scheduledDate === today && post.stage !== 'publicado';
  const cover = coverOf(post);
  const numAnexos = post.mediaUrls?.length ?? (post.mediaUrl ? 1 : 0);

  return (
    <div className={cn(
      'cursor-pointer touch-none select-none overflow-hidden rounded-lg border border-line bg-ink-850 shadow-sm transition hover:border-white/20',
      dragging && 'rotate-2 border-brand-400/60 shadow-xl',
      selected && 'border-brand-400/70 ring-2 ring-brand-400/50',
    )}>
      {cover && <img src={cover} alt="" className="h-28 w-full object-cover" />}
      <div className="p-2.5">
      {/* barra de etiqueta estilo Trello */}
      <div className="mb-2 flex items-center gap-1.5">
        <span className="h-1.5 w-9 rounded-full" style={{ background: PLATFORM_COLOR[post.platform] }} title={post.platform} />
        {(late || dueToday) && (
          <span className={cn('inline-flex items-center gap-1 rounded px-1 text-[10px] font-medium', late ? 'bg-red-500/15 text-red-300' : 'bg-amber-500/15 text-amber-300')}>
            <AlertTriangle size={10} /> {late ? 'atrasado' : 'hoje'}
          </span>
        )}
        {post.awaitingMaterial && (
          <span className="inline-flex items-center gap-1 rounded bg-amber-500/15 px-1 text-[10px] font-medium text-amber-300">
            <VideoOff size={10} /> falta material
          </span>
        )}
      </div>
      <p className="text-sm leading-snug text-white/90">{post.title}</p>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/8">
        <div className="h-full rounded-full" style={{ width: `${progress}%`, background: STAGE_META[post.stage].color }} />
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] text-white/45">
        <span className="text-white/40">{post.platform}</span>
        {numAnexos > 0 && <span className="inline-flex items-center gap-1 text-brand-300" title="Tem imagem anexada"><ImageIcon size={11} /> {numAnexos > 1 && numAnexos}</span>}
        {post.checklist.length > 0 && <span className="inline-flex items-center gap-1"><CheckSquare size={11} /> {done}/{post.checklist.length}</span>}
        {pendRev > 0 && <span className="inline-flex items-center gap-1 text-rose-300"><MessageSquare size={11} /> {pendRev}</span>}
        {post.sentForApproval && post.stage === 'aprovacao' && <Badge color="#ec4899">no grupo</Badge>}
        <span className="ml-auto flex items-center gap-2">
          {client && <span className="inline-flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full" style={{ background: client.color }} />{client.name}</span>}
          {post.scheduledDate && <span>{new Date(post.scheduledDate + 'T00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}</span>}
          {assignee && <Avatar name={assignee.name} color={assignee.color} size={18} />}
        </span>
      </div>
      </div>
    </div>
  );
}
