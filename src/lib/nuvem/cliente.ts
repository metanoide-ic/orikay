import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Conexão com a nuvem do Orikay (Supabase).
 *
 * A URL e a chave "anon" são públicas por design: quem protege os dados é a
 * RLS do banco (cada agência só enxerga a si mesma). Sem as duas definidas,
 * a plataforma roda no modo antigo, só no navegador.
 */
const URL_NUVEM = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() ?? '';
const CHAVE_NUVEM = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim() ?? '';

export const NUVEM = Boolean(URL_NUVEM && CHAVE_NUVEM);

export const nuvem: SupabaseClient = NUVEM
  ? createClient(URL_NUVEM, CHAVE_NUVEM, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        // PKCE devolve ?code= na URL (e não #access_token), o que convive com
        // o HashRouter da plataforma nos links de confirmação e de senha.
        flowType: 'pkce',
        storageKey: 'orikay.sessao',
      },
      realtime: { params: { eventsPerSecond: 20 } },
    })
  : (null as unknown as SupabaseClient);

/** Endereço público do site, para os links de e-mail voltarem para cá. */
export function enderecoDoSite(): string {
  // App desktop abre por file://: o link do e-mail precisa voltar pro site.
  if (!/^https?:$/.test(window.location.protocol)) return 'https://orikay.com.br/';
  return window.location.origin + window.location.pathname;
}

/** Mensagem de erro do Supabase em português, para mostrar na tela. */
export function traduzErro(e: unknown): string {
  const msg = (e as { message?: string })?.message ?? String(e ?? '');
  const m = msg.toLowerCase();
  if (m.includes('invalid login credentials')) return 'E-mail ou senha incorretos.';
  if (m.includes('email not confirmed')) return 'Confirme seu e-mail pelo link que enviamos antes de entrar.';
  if (m.includes('user already registered') || m.includes('already been registered')) return 'Já existe uma conta com este e-mail. Entre com ela.';
  if (m.includes('password should be at least')) return 'A senha precisa de pelo menos 6 caracteres.';
  if (m.includes('unable to validate email') || m.includes('invalid email')) return 'E-mail inválido.';
  if (m.includes('rate limit') || m.includes('too many')) return 'Muitas tentativas seguidas. Espere um minuto e tente de novo.';
  if (m.includes('failed to fetch') || m.includes('network')) return 'Sem conexão com a internet.';
  if (m.includes('jwt') || m.includes('session')) return 'Sua sessão expirou. Entre de novo.';
  return msg || 'Algo deu errado.';
}
