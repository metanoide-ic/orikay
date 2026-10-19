import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Account } from './types';
import { hash, pickColor, uid } from './utils';

/**
 * Contas do modo local (sem nuvem). Não existe conta de fábrica: o código
 * vai inteiro para o navegador de quem abre o site, então nenhum login de
 * agência pode morar aqui. A primeira pessoa cria a conta na tela de entrada.
 */
const TEAM: Array<Omit<Account, 'id' | 'color' | 'createdAt'>> = [];

function norm(s: string) {
  return s.trim().toLowerCase();
}

interface AuthState {
  accounts: Account[];
  currentId: string | null;
  ensureTeam: () => void;
  signup: (input: { name: string; login?: string; email?: string; password: string; role?: string }) => { ok: boolean; error?: string };
  login: (identifier: string, password: string) => { ok: boolean; error?: string };
  logout: () => void;
  updateProfile: (patch: Partial<Pick<Account, 'name' | 'role' | 'color'>>) => void;
  changePassword: (current: string, next: string) => { ok: boolean; error?: string };
  /** Define a senha definitiva de quem ainda está com a provisória. */
  setInitialPassword: (next: string) => { ok: boolean; error?: string };
  setPermission: (id: string, patch: Partial<Pick<Account, 'canFinance' | 'admin' | 'role'>>) => void;
  addMember: (input: { name: string; password: string; role?: string; canFinance?: boolean; admin?: boolean }) => { ok: boolean; error?: string };
  removeMember: (id: string) => void;
  current: () => Account | null;
}

export const useAuth = create<AuthState>()(
  persist(
    (set, get) => ({
      accounts: [],
      currentId: null,

      ensureTeam: () => {
        const existing = get().accounts;
        const toAdd: Account[] = [];
        for (const t of TEAM) {
          if (existing.some((a) => norm(a.login) === norm(t.login))) continue;
          toAdd.push({
            id: uid('user'),
            name: t.name,
            login: t.login,
            role: t.role,
            canFinance: t.canFinance,
            admin: t.admin,
            passHash: t.passHash,
            mustChangePassword: true,
            color: pickColor(t.login),
            createdAt: Date.now(),
          });
        }
        if (toAdd.length) set((s) => ({ accounts: [...s.accounts, ...toAdd] }));
      },

      signup: ({ name, login, email, password, role }) => {
        const loginId = (login || name).trim();
        if (!name.trim()) return { ok: false, error: 'Informe seu nome.' };
        if (password.length < 4) return { ok: false, error: 'A senha precisa de ao menos 4 caracteres.' };
        if (get().accounts.some((a) => norm(a.login) === norm(loginId)))
          return { ok: false, error: 'Já existe uma conta com este login.' };
        // A primeira conta do aparelho administra (senão ninguém conseguiria
        // liberar o Financeiro nem adicionar a equipe).
        const primeira = get().accounts.length === 0;
        const account: Account = {
          id: uid('user'),
          name: name.trim(),
          login: loginId,
          email: email?.trim() || undefined,
          passHash: hash(password),
          role: role?.trim() || (primeira ? 'Direção' : 'Membro da equipe'),
          color: pickColor(loginId),
          canFinance: primeira,
          admin: primeira,
          createdAt: Date.now(),
        };
        set((s) => ({ accounts: [...s.accounts, account], currentId: account.id }));
        return { ok: true };
      },

      login: (identifier, password) => {
        const id = norm(identifier);
        const acc = get().accounts.find((a) => norm(a.login) === id || (a.email && norm(a.email) === id));
        if (!acc) return { ok: false, error: 'Conta não encontrada.' };
        if (acc.passHash !== hash(password)) return { ok: false, error: 'Senha incorreta.' };
        set({ currentId: acc.id });
        return { ok: true };
      },

      logout: () => set({ currentId: null }),

      updateProfile: (patch) =>
        set((s) => ({ accounts: s.accounts.map((a) => (a.id === s.currentId ? { ...a, ...patch } : a)) })),

      changePassword: (current, next) => {
        const me = get().accounts.find((a) => a.id === get().currentId);
        if (!me) return { ok: false, error: 'Sessão inválida.' };
        if (me.passHash !== hash(current)) return { ok: false, error: 'Senha atual incorreta.' };
        if (next.length < 6) return { ok: false, error: 'A nova senha precisa de ao menos 6 caracteres.' };
        set((s) => ({
          accounts: s.accounts.map((a) =>
            a.id === me.id ? { ...a, passHash: hash(next), mustChangePassword: false } : a),
        }));
        return { ok: true };
      },

      setInitialPassword: (next) => {
        const me = get().accounts.find((a) => a.id === get().currentId);
        if (!me) return { ok: false, error: 'Sessão inválida.' };
        if (next.length < 6) return { ok: false, error: 'A nova senha precisa de ao menos 6 caracteres.' };
        if (me.passHash === hash(next)) {
          return { ok: false, error: 'Escolha uma senha diferente da provisória.' };
        }
        set((s) => ({
          accounts: s.accounts.map((a) =>
            a.id === me.id ? { ...a, passHash: hash(next), mustChangePassword: false } : a),
        }));
        return { ok: true };
      },

      setPermission: (id, patch) =>
        set((s) => ({ accounts: s.accounts.map((a) => (a.id === id ? { ...a, ...patch } : a)) })),

      addMember: ({ name, password, role, canFinance, admin }) => {
        const loginId = name.trim();
        if (!loginId) return { ok: false, error: 'Informe o nome.' };
        if (password.length < 4) return { ok: false, error: 'Senha de ao menos 4 caracteres.' };
        if (get().accounts.some((a) => norm(a.login) === norm(loginId)))
          return { ok: false, error: 'Já existe um membro com este login.' };
        const account: Account = {
          id: uid('user'), name: loginId, login: loginId,
          passHash: hash(password), role: role?.trim() || 'Membro da equipe',
          // Senha escolhida pelo admin é provisória: a pessoa troca no 1º acesso.
          mustChangePassword: true,
          color: pickColor(loginId), canFinance: !!canFinance, admin: !!admin, createdAt: Date.now(),
        };
        set((s) => ({ accounts: [...s.accounts, account] }));
        return { ok: true };
      },

      removeMember: (id) =>
        set((s) => (id === s.currentId ? s : { accounts: s.accounts.filter((a) => a.id !== id) })),

      current: () => {
        const { accounts, currentId } = get();
        return accounts.find((a) => a.id === currentId) ?? null;
      },
    }),
    { name: 'origem.auth' },
  ),
);
