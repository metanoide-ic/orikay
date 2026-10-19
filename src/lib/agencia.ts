import { useSessao } from './nuvem/sessao';

/** Nome da agência logada (vai nas mensagens a clientes, na IA e no PDF). */
export function nomeDaAgencia(): string {
  const { agencias, agenciaId } = useSessao.getState();
  return agencias.find((a) => a.id === agenciaId)?.nome ?? 'nossa agência';
}

/** Hook: nome da agência para mostrar na tela. */
export function useNomeDaAgencia(): string | undefined {
  return useSessao((s) => s.agencias.find((a) => a.id === s.agenciaId)?.nome);
}

/** "da agência X" (ou "de uma agência de marketing" sem nome), para os textos da IA. */
export function daAgencia(): string {
  const { agencias, agenciaId } = useSessao.getState();
  const nome = agencias.find((a) => a.id === agenciaId)?.nome;
  return nome ? `da agência ${nome}` : 'de uma agência de marketing';
}
