import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Library as LibIcon, Copy as CopyIcon, Trash2, Pencil, Send } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { Button, Field, Input, Textarea, Modal, Select, Badge, EmptyState } from '@/components/ui';
import { useData } from '@/lib/dataStore';
import { PLATFORMS, PLATFORM_COLOR } from '@/lib/labels';
import type { LibraryItem, PostPlatform } from '@/lib/types';

const CATS = ['Autoridade', 'Conexão', 'Educativo', 'Oferta', 'Bastidores', 'Prova social', 'Data comemorativa'];
const blank = { title: '', platform: 'Instagram' as PostPlatform, category: 'Educativo', caption: '', hashtags: '' };

export default function Library() {
  const { library, addLibraryItem, updateLibraryItem, removeLibraryItem, addPost } = useData();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<LibraryItem | null>(null);
  const [form, setForm] = useState(blank);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  function openNew() { setEditing(null); setForm(blank); setOpen(true); }
  function openEdit(i: LibraryItem) {
    setEditing(i);
    setForm({ title: i.title, platform: i.platform ?? 'Instagram', category: i.category, caption: i.caption, hashtags: i.hashtags ?? '' });
    setOpen(true);
  }
  function save() {
    if (!form.title.trim()) return;
    if (editing) updateLibraryItem(editing.id, form);
    else addLibraryItem(form);
    setOpen(false);
  }
  function usarComoPost(i: LibraryItem) {
    addPost({ title: i.title, platform: i.platform ?? 'Instagram', stage: 'ideia', caption: i.caption, copy: `${i.caption}${i.hashtags ? `\n\n${i.hashtags}` : ''}` });
    navigate('/app/posts');
  }

  return (
    <div>
      <PageHeader
        title="Biblioteca de Postagens"
        subtitle="Modelos e legendas reutilizáveis para agilizar a produção."
        action={<Button onClick={openNew}><Plus size={18} /> Novo modelo</Button>}
      />

      {library.length === 0 ? (
        <EmptyState icon={<LibIcon size={40} />} title="Biblioteca vazia" description="Salve modelos de legenda para reaproveitar em qualquer cliente."
          action={<Button onClick={openNew}><Plus size={18} /> Criar modelo</Button>} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {library.map((i) => (
            <div key={i.id} className="card group flex flex-col p-5">
              <div className="flex items-center justify-between">
                {i.platform && <Badge color={PLATFORM_COLOR[i.platform]}>{i.platform}</Badge>}
                <Badge>{i.category}</Badge>
              </div>
              <h3 className="mt-3 font-semibold text-white">{i.title}</h3>
              <p className="mt-2 flex-1 whitespace-pre-wrap text-sm leading-relaxed text-white/60 line-clamp-6">{i.caption}</p>
              {i.hashtags && <p className="mt-2 text-xs text-brand-300/80 line-clamp-2">{i.hashtags}</p>}
              <div className="mt-4 flex flex-wrap gap-1.5">
                <Button size="sm" variant="soft" onClick={() => usarComoPost(i)}><Send size={14} /> Usar como post</Button>
                <Button size="sm" variant="ghost" onClick={() => { navigator.clipboard?.writeText(`${i.caption}${i.hashtags ? `\n\n${i.hashtags}` : ''}`); setCopiedId(i.id); setTimeout(() => setCopiedId(null), 1500); }}>
                  <CopyIcon size={14} /> {copiedId === i.id ? 'Copiado' : 'Copiar'}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => openEdit(i)}><Pencil size={14} /></Button>
                <Button size="sm" variant="ghost" onClick={() => removeLibraryItem(i.id)}><Trash2 size={14} /></Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'Editar modelo' : 'Novo modelo'} wide
        footer={<><Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button><Button onClick={save}>{editing ? 'Salvar' : 'Adicionar'}</Button></>}>
        <div className="space-y-4">
          <Field label="Título"><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Ex.: Prova social" autoFocus /></Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Plataforma">
              <Select value={form.platform} onChange={(e) => setForm({ ...form, platform: e.target.value as PostPlatform })}>{PLATFORMS.map((p) => <option key={p}>{p}</option>)}</Select>
            </Field>
            <Field label="Categoria">
              <Select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>{CATS.map((c) => <option key={c}>{c}</option>)}</Select>
            </Field>
          </div>
          <Field label="Legenda"><Textarea value={form.caption} onChange={(e) => setForm({ ...form, caption: e.target.value })} className="min-h-[120px]" placeholder="Use [CLIENTE], [DICA] como marcadores…" /></Field>
          <Field label="Hashtags"><Input value={form.hashtags} onChange={(e) => setForm({ ...form, hashtags: e.target.value })} placeholder="#marketing #origem" /></Field>
        </div>
      </Modal>
    </div>
  );
}
