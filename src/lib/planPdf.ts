import type { Client } from './types';
import type { PlanItem } from './planner';

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const DIAS = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];

// No papel o fundo é branco, então a marca sai no tom escuro da identidade.
const LOGO_SVG = `<svg viewBox="0 0 100 100" width="44" height="44" xmlns="http://www.w3.org/2000/svg"><path d="M54.71 30.08 A26 26 0 1 0 54.71 69.92" fill="none" stroke="#16151c" stroke-width="14"/><path d="M58 50 L78 20 L94 20 L74 50 Z" fill="#16151c"/><path d="M58 50 L78 80 L94 80 L74 50 Z" fill="#16151c"/></svg>`;

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Abre o planejamento num layout de impressão com a identidade da Origem.
 * O usuário salva como PDF pelo diálogo do navegador (Ctrl+P já aberto).
 */
export function openPlanPdf(client: Client, items: PlanItem[], year: number, month: number): void {
  const rows = items
    .map((i) => {
      const d = new Date(i.date + 'T00:00');
      return `<tr>
        <td class="data"><b>${String(d.getDate()).padStart(2, '0')}/${String(month + 1).padStart(2, '0')}</b><span>${DIAS[d.getDay()]}</span></td>
        <td class="formato">${esc(i.type)}</td>
        <td class="tema">${esc(i.title.replace(/^[^:]+:\s*/, ''))}<small>${esc(i.brief)}</small>${i.holiday ? `<em>${esc(i.holiday)}</em>` : ''}</td>
      </tr>`;
    })
    .join('');

  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<title>Planejamento ${esc(client.name)} - ${MESES[month]} ${year}</title>
<style>
  @page { size: A4; margin: 18mm 16mm; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif; color: #1c1c28; }
  header { display: flex; align-items: center; justify-content: space-between; padding-bottom: 18px; border-bottom: 3px solid #7c5cff; }
  .marca { display: flex; align-items: center; gap: 12px; }
  .marca .nome { font-size: 19px; font-weight: 700; letter-spacing: 5px; }
  .marca .tag { font-size: 8px; letter-spacing: 3px; color: #8a8a99; margin-top: 3px; }
  .doc { text-align: right; }
  .doc .titulo { font-size: 11px; letter-spacing: 2px; color: #8a8a99; text-transform: uppercase; }
  .doc .mes { font-size: 21px; font-weight: 700; margin-top: 2px; }
  .cliente { margin: 26px 0 6px; }
  .cliente h1 { font-size: 26px; font-weight: 700; }
  .cliente p { margin-top: 6px; font-size: 12px; line-height: 1.55; color: #4a4a5a; max-width: 640px; }
  .resumo { display: flex; gap: 26px; margin: 18px 0 22px; }
  .resumo div { font-size: 12px; color: #4a4a5a; }
  .resumo b { display: block; font-size: 19px; color: #1c1c28; }
  table { width: 100%; border-collapse: collapse; }
  thead th { text-align: left; font-size: 10px; letter-spacing: 1.5px; text-transform: uppercase; color: #8a8a99; padding: 0 10px 8px; border-bottom: 1.5px solid #e4e4ee; }
  tbody td { padding: 9px 10px; border-bottom: 1px solid #eeeef4; font-size: 12.5px; vertical-align: top; }
  tbody tr:nth-child(even) { background: #fafaff; }
  td.data { width: 92px; white-space: nowrap; }
  td.data span { display: block; font-size: 10px; color: #8a8a99; }
  td.formato { width: 92px; font-weight: 600; color: #5836c4; }
  td.tema em { display: block; font-style: normal; font-size: 10.5px; color: #b0812a; margin-top: 2px; }
  td.tema small { display: block; font-size: 10px; color: #6b6b7d; margin-top: 2px; line-height: 1.4; }
  footer { margin-top: 26px; padding-top: 12px; border-top: 1px solid #e4e4ee; display: flex; justify-content: space-between; font-size: 10px; color: #8a8a99; letter-spacing: 1px; }
</style></head><body>
<header>
  <div class="marca">${LOGO_SVG}<div><div class="nome">Orikay</div><div class="tag">COMUNICAÇÃO &amp; MARKETING</div></div></div>
  <div class="doc"><div class="titulo">Planejamento de conteúdo</div><div class="mes">${MESES[month]} ${year}</div></div>
</header>
<div class="cliente">
  <h1>${esc(client.name)}</h1>
  ${client.briefing ? `<p>${esc(client.briefing)}</p>` : ''}
</div>
<div class="resumo">
  <div><b>${items.length}</b>publicações no mês</div>
  <div><b>${items.filter((i) => /víd|reels/i.test(i.type)).length}</b>vídeos</div>
  <div><b>${items.filter((i) => i.holiday).length}</b>datas comemorativas</div>
</div>
<table>
  <thead><tr><th>Data</th><th>Formato</th><th>Tema</th></tr></thead>
  <tbody>${rows}</tbody>
</table>
<footer><span>Origem Comunicação &amp; Marketing</span><span>Estratégia · Criatividade · Resultados</span></footer>
<script>window.addEventListener('load', function(){ setTimeout(function(){ window.print(); }, 250); });</script>
</body></html>`;

  const win = window.open('', '_blank');
  if (!win) return;
  win.document.write(html);
  win.document.close();
}
