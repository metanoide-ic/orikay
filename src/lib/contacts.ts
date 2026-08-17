import { useData } from './dataStore';

function normalizar(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

/** Lê "Nome do cliente: telefone" por linha, uma entrada por linha. */
function parseLinhas(texto: string): Array<{ nome: string; telefone: string }> {
  return texto
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const i = l.indexOf(':');
      if (i < 0) return null;
      const nome = l.slice(0, i).trim();
      const telefone = l.slice(i + 1).trim();
      return nome && telefone ? { nome, telefone } : null;
    })
    .filter((x): x is { nome: string; telefone: string } => x !== null);
}

/**
 * Preenche o WhatsApp de cobrança de cada cliente pelo nome, direto na base
 * local — nada disso passa pelo código-fonte nem pelo repositório: fica só
 * no navegador de quem colou.
 */
export function applyBillingContacts(texto: string): { aplicados: string[]; naoEncontrados: string[] } {
  const store = useData.getState();
  const linhas = parseLinhas(texto);
  const aplicados: string[] = [];
  const naoEncontrados: string[] = [];

  for (const { nome, telefone } of linhas) {
    const alvo = normalizar(nome);
    const cliente = store.clients.find((c) => normalizar(c.name) === alvo)
      ?? store.clients.find((c) => normalizar(c.name).includes(alvo) || alvo.includes(normalizar(c.name)));
    if (cliente) {
      store.updateClient(cliente.id, { billingWhatsapp: telefone });
      aplicados.push(cliente.name);
    } else {
      naoEncontrados.push(nome);
    }
  }
  return { aplicados, naoEncontrados };
}
