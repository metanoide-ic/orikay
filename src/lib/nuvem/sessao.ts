import { create } from 'zustand';
import type { User } from '@supabase/supabase-js';
import { nuvem, NUVEM, enderecoDoSite, traduzErro } from './cliente';
import { useAuth } from '../authStore';
import type { Account } from '../types';

/**
 * Sessão na nuvem: quem está logado, em qual agência e quem mais está nela.
 *
 * O resto da plataforma continua lendo `useAuth` (accounts/current) como
 * sempre; aqui a equipe da agência é espelhada nele, então as telas de
 * posts, vídeos, permissões etc. não precisam saber de onde vêm as contas.
 */

export interface Membro {
  agencia_id: string;
  user_id: string;
  nome: string;
  email: string | null;
  cargo: string;
  cor: string;
  admin: boolean;
  financeiro: boolean;
  entrou_em: string;
}

export interface Agencia { id: string; nome: string }

export type Fase = 'carregando' | 'deslogado' | 'sem-agencia' | 'pronta' | 'nova-senha';

interface SessaoState {
  fase: Fase;
  user: User | null;
  agencias: Agencia[];
  agenciaId: string | null;
  membros: Membro[];
  /** Token de convite aberto antes do login: aceito assim que a pessoa entrar. */
  convitePendente: string | null;
}

const CHAVE_AGENCIA = 'orikay.agencia';
const CHAVE_CONVITE = 'orikay.convite';

export const useSessao = create<SessaoState>(() => ({
  fase: NUVEM ? 'carregando' : 'deslogado',
  user: null,
  agencias: [],
  agenciaId: null,
  membros: [],
  convitePendente: lerLocal(CHAVE_CONVITE),
}));

function lerLocal(chave: string): string | null {
  try { return localStorage.getItem(chave); } catch { return null; }
}
function gravarLocal(chave: string, valor: string | null) {
  try {
    if (valor) localStorage.setItem(chave, valor);
    else localStorage.removeItem(chave);
  } catch { /* modo privado: segue sem lembrar */ }
}

function paraConta(m: Membro): Account {
  return {
    id: m.user_id,
    name: m.nome,
    login: m.email ?? m.nome,
    email: m.email ?? undefined,
    passHash: '',
    role: m.cargo,
    color: m.cor,
    canFinance: m.financeiro || m.admin,
    admin: m.admin,
    createdAt: Date.parse(m.entrou_em) || Date.now(),
  };
}

/** Espelha a equipe e quem está logado no `useAuth` que as telas já usam. */
function espelharNoAuth() {
  const { membros, user, fase } = useSessao.getState();
  if (fase !== 'pronta' || !user) {
    useAuth.setState({ currentId: null, accounts: [] });
    return;
  }
  useAuth.setState({ accounts: membros.map(paraConta), currentId: user.id });
}

export function euNaAgencia(): Membro | undefined {
  const { membros, user } = useSessao.getState();
  return membros.find((m) => m.user_id === user?.id);
}

/* ------------------------------------------------------------------ */

async function carregarMembros(agenciaId: string): Promise<Membro[]> {
  const { data, error } = await nuvem.from('membros').select('*').eq('agencia_id', agenciaId).order('entrou_em');
  if (error) throw error;
  return (data ?? []) as Membro[];
}

/** Descobre as agências do usuário e entra na última usada (ou na primeira). */
async function entrarNaAgencia(user: User): Promise<void> {
  // Convite aberto antes do login: aceita agora.
  const convite = useSessao.getState().convitePendente;
  if (convite) {
    try {
      const nome = (user.user_metadata?.nome as string | undefined) ?? '';
      const { data } = await nuvem.rpc('aceitar_convite', { p_token: convite, p_nome: nome });
      if (data) gravarLocal(CHAVE_AGENCIA, String(data));
    } catch { /* convite inválido: a tela de convite mostra o motivo */ }
    gravarLocal(CHAVE_CONVITE, null);
    useSessao.setState({ convitePendente: null });
  }

  const { data: minhas, error } = await nuvem
    .from('membros').select('agencia_id, agencias(id, nome)').eq('user_id', user.id);
  if (error) throw error;
  let agencias = (minhas ?? [])
    .map((r) => (r as unknown as { agencias: Agencia | null }).agencias)
    .filter((a): a is Agencia => Boolean(a));

  // Conta criada com e-mail a confirmar: a agência foi pedida no cadastro e
  // só pode ser criada agora, com a sessão de verdade.
  const pedida = user.user_metadata?.agencia_pendente as string | undefined;
  if (agencias.length === 0 && pedida) {
    const { data: id, error: e } = await nuvem.rpc('criar_agencia', {
      p_nome: pedida,
      p_meu_nome: (user.user_metadata?.nome as string) ?? '',
      p_cargo: (user.user_metadata?.cargo as string) ?? 'Direção',
    });
    if (!e && id) {
      agencias = [{ id: String(id), nome: pedida }];
      await nuvem.auth.updateUser({ data: { agencia_pendente: null } });
    }
  }

  if (agencias.length === 0) {
    useSessao.setState({ fase: 'sem-agencia', user, agencias: [], agenciaId: null, membros: [] });
    espelharNoAuth();
    return;
  }

  const lembrada = lerLocal(CHAVE_AGENCIA);
  const escolhida = agencias.find((a) => a.id === lembrada) ?? agencias[0];
  gravarLocal(CHAVE_AGENCIA, escolhida.id);
  const membros = await carregarMembros(escolhida.id);
  useSessao.setState({ fase: 'pronta', user, agencias, agenciaId: escolhida.id, membros });
  espelharNoAuth();
}

let iniciada = false;

/** Liga a sessão uma vez, na abertura do app. */
export function iniciarSessao(): void {
  if (!NUVEM || iniciada) return;
  iniciada = true;

  nuvem.auth.onAuthStateChange((evento, sessao) => {
    if (evento === 'PASSWORD_RECOVERY') {
      useSessao.setState({ fase: 'nova-senha', user: sessao?.user ?? null });
      return;
    }
    if (evento === 'SIGNED_OUT' || !sessao) {
      useSessao.setState({ fase: 'deslogado', user: null, agencias: [], agenciaId: null, membros: [] });
      espelharNoAuth();
      return;
    }
    if (evento === 'INITIAL_SESSION' || evento === 'SIGNED_IN') {
      const atual = useSessao.getState();
      if (atual.fase === 'nova-senha') return;
      if (atual.fase === 'pronta' && atual.user?.id === sessao.user.id) return;
      // Fora do callback: chamar o Supabase aqui dentro trava o cliente.
      setTimeout(() => {
        entrarNaAgencia(sessao.user).catch(() => {
          useSessao.setState({ fase: 'sem-agencia', user: sessao.user });
          espelharNoAuth();
        });
      }, 0);
    }
    if (evento === 'USER_UPDATED') useSessao.setState({ user: sessao.user });
  });
}

/* ------------------------------------------------------------------ */
/*  Ações das telas                                                    */
/* ------------------------------------------------------------------ */

type Resultado = { ok: true; aviso?: string } | { ok: false; erro: string };

export async function entrar(email: string, senha: string): Promise<Resultado> {
  const { error } = await nuvem.auth.signInWithPassword({ email: email.trim(), password: senha });
  return error ? { ok: false, erro: traduzErro(error) } : { ok: true };
}

/**
 * Cria a conta. Com `agencia`, cria também a agência (agora, se o e-mail não
 * precisa de confirmação; ou no primeiro login, se precisar).
 */
export async function criarConta(input: { nome: string; email: string; senha: string; agencia?: string; cargo?: string }): Promise<Resultado> {
  if (!input.nome.trim()) return { ok: false, erro: 'Informe seu nome.' };
  if (input.senha.length < 6) return { ok: false, erro: 'A senha precisa de pelo menos 6 caracteres.' };
  const { data, error } = await nuvem.auth.signUp({
    email: input.email.trim(),
    password: input.senha,
    options: {
      emailRedirectTo: enderecoDoSite(),
      data: { nome: input.nome.trim(), cargo: input.cargo ?? 'Direção', agencia_pendente: input.agencia?.trim() || null },
    },
  });
  if (error) return { ok: false, erro: traduzErro(error) };
  // Supabase devolve usuário sem identidades quando o e-mail já existe.
  if (data.user && data.user.identities?.length === 0) {
    return { ok: false, erro: 'Já existe uma conta com este e-mail. Entre com ela.' };
  }
  if (!data.session) {
    return { ok: true, aviso: `Enviamos um link de confirmação para ${input.email.trim()}. Abra o e-mail e clique no link para entrar.` };
  }
  return { ok: true };
}

export async function criarAgencia(nome: string, meuNome: string, cargo = 'Direção'): Promise<Resultado> {
  const { error } = await nuvem.rpc('criar_agencia', { p_nome: nome, p_meu_nome: meuNome, p_cargo: cargo });
  if (error) return { ok: false, erro: traduzErro(error) };
  const user = useSessao.getState().user;
  if (user) await entrarNaAgencia(user);
  return { ok: true };
}

export async function sair(): Promise<void> {
  await nuvem.auth.signOut();
}

export async function pedirNovaSenha(email: string): Promise<Resultado> {
  const { error } = await nuvem.auth.resetPasswordForEmail(email.trim(), { redirectTo: enderecoDoSite() });
  return error
    ? { ok: false, erro: traduzErro(error) }
    : { ok: true, aviso: `Se existir uma conta com ${email.trim()}, chega um link para criar a senha nova.` };
}

export async function definirNovaSenha(senha: string): Promise<Resultado> {
  if (senha.length < 6) return { ok: false, erro: 'A senha precisa de pelo menos 6 caracteres.' };
  const { data, error } = await nuvem.auth.updateUser({ password: senha });
  if (error) return { ok: false, erro: traduzErro(error) };
  useSessao.setState({ fase: 'carregando' });
  if (data.user) await entrarNaAgencia(data.user);
  return { ok: true };
}

/** Troca de senha logado: confere a atual antes. */
export async function trocarSenha(atual: string, nova: string): Promise<Resultado> {
  const email = useSessao.getState().user?.email;
  if (!email) return { ok: false, erro: 'Sessão expirada. Entre de novo.' };
  if (nova.length < 6) return { ok: false, erro: 'A nova senha precisa de pelo menos 6 caracteres.' };
  const conferida = await nuvem.auth.signInWithPassword({ email, password: atual });
  if (conferida.error) return { ok: false, erro: 'Senha atual incorreta.' };
  const { error } = await nuvem.auth.updateUser({ password: nova });
  return error ? { ok: false, erro: traduzErro(error) } : { ok: true };
}

export async function atualizarPerfil(patch: { nome?: string; cor?: string; cargo?: string }): Promise<Resultado> {
  const { agenciaId } = useSessao.getState();
  if (!agenciaId) return { ok: false, erro: 'Sem agência.' };
  const { error } = await nuvem.rpc('atualizar_perfil', {
    p_agencia: agenciaId, p_nome: patch.nome ?? '', p_cor: patch.cor ?? '', p_cargo: patch.cargo ?? '',
  });
  if (error) return { ok: false, erro: traduzErro(error) };
  await recarregarEquipe();
  return { ok: true };
}

export async function recarregarEquipe(): Promise<void> {
  const { agenciaId } = useSessao.getState();
  if (!agenciaId) return;
  const membros = await carregarMembros(agenciaId);
  const user = useSessao.getState().user;
  // Fui removido da agência por um admin: volta para a escolha de agência.
  if (user && !membros.some((m) => m.user_id === user.id)) {
    gravarLocal(CHAVE_AGENCIA, null);
    await entrarNaAgencia(user);
    return;
  }
  useSessao.setState({ membros });
  espelharNoAuth();
}

export async function definirPermissoes(userId: string, p: { admin: boolean; financeiro: boolean; cargo?: string }): Promise<Resultado> {
  const { agenciaId } = useSessao.getState();
  const { error } = await nuvem.rpc('definir_permissoes', {
    p_agencia: agenciaId, p_user: userId, p_admin: p.admin, p_financeiro: p.financeiro, p_cargo: p.cargo ?? null,
  });
  if (error) return { ok: false, erro: traduzErro(error) };
  await recarregarEquipe();
  return { ok: true };
}

export async function removerMembro(userId: string): Promise<Resultado> {
  const { agenciaId } = useSessao.getState();
  const { error } = await nuvem.rpc('remover_membro', { p_agencia: agenciaId, p_user: userId });
  if (error) return { ok: false, erro: traduzErro(error) };
  await recarregarEquipe();
  return { ok: true };
}

export interface Convite { token: string; cargo: string; admin: boolean; financeiro: boolean; expira_em: string; usado_em: string | null }

export function linkDoConvite(token: string): string {
  return `${enderecoDoSite()}#/convite/${token}`;
}

export async function criarConvite(p: { cargo: string; admin: boolean; financeiro: boolean }): Promise<{ ok: true; link: string } | { ok: false; erro: string }> {
  const { agenciaId, user } = useSessao.getState();
  const { data, error } = await nuvem.from('convites')
    .insert({ agencia_id: agenciaId, cargo: p.cargo, admin: p.admin, financeiro: p.financeiro, criado_por: user?.id })
    .select('token').single();
  if (error || !data) return { ok: false, erro: traduzErro(error) };
  return { ok: true, link: linkDoConvite(data.token as string) };
}

export async function listarConvites(): Promise<Convite[]> {
  const { agenciaId } = useSessao.getState();
  const { data } = await nuvem.from('convites').select('token, cargo, admin, financeiro, expira_em, usado_em')
    .eq('agencia_id', agenciaId).is('usado_em', null).gt('expira_em', new Date().toISOString())
    .order('criado_em', { ascending: false });
  return (data ?? []) as Convite[];
}

export async function cancelarConvite(token: string): Promise<void> {
  await nuvem.from('convites').delete().eq('token', token);
}

export async function verConvite(token: string): Promise<{ agencia: string; cargo: string; valido: boolean } | null> {
  const { data } = await nuvem.rpc('ver_convite', { p_token: token });
  const linha = (data as Array<{ agencia: string; cargo: string; valido: boolean }> | null)?.[0];
  return linha ?? null;
}

/** Guarda o convite para aceitar depois do login/cadastro. */
export function guardarConvite(token: string) {
  gravarLocal(CHAVE_CONVITE, token);
  useSessao.setState({ convitePendente: token });
}

/** Já logado: entra direto na agência do convite. */
export async function aceitarConvite(token: string): Promise<Resultado> {
  const user = useSessao.getState().user;
  if (!user) { guardarConvite(token); return { ok: true }; }
  const { data, error } = await nuvem.rpc('aceitar_convite', { p_token: token, p_nome: (user.user_metadata?.nome as string) ?? '' });
  if (error) return { ok: false, erro: traduzErro(error) };
  gravarLocal(CHAVE_AGENCIA, String(data));
  useSessao.setState({ fase: 'carregando' });
  await entrarNaAgencia(user);
  return { ok: true };
}

export async function trocarDeAgencia(id: string): Promise<void> {
  const user = useSessao.getState().user;
  if (!user) return;
  gravarLocal(CHAVE_AGENCIA, id);
  useSessao.setState({ fase: 'carregando' });
  await entrarNaAgencia(user);
}

export async function renomearAgencia(nome: string): Promise<Resultado> {
  const { agenciaId, agencias } = useSessao.getState();
  if (!nome.trim()) return { ok: false, erro: 'Informe o nome da agência.' };
  const { error } = await nuvem.from('agencias').update({ nome: nome.trim() }).eq('id', agenciaId);
  if (error) return { ok: false, erro: traduzErro(error) };
  useSessao.setState({ agencias: agencias.map((a) => (a.id === agenciaId ? { ...a, nome: nome.trim() } : a)) });
  return { ok: true };
}
