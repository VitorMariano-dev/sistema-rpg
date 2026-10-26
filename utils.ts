import { CustomField, FieldType, ResourceValue, SessionLog } from './types';

/**
 * Atualiza um recurso (Vida/Mana). O valor atual só é limitado ao máximo quando
 * existe um máximo definido, para que o jogador possa preencher em qualquer ordem.
 */
export const updateResource = (
  resource: ResourceValue | undefined,
  field: 'current' | 'max',
  value: number
): ResourceValue => {
  const safe = Number.isFinite(value) ? value : 0;
  let current = resource?.current ?? 0;
  let max = resource?.max ?? 0;

  if (field === 'max') {
    max = safe;
  } else {
    current = safe;
  }
  if (max > 0 && current > max) current = max;

  return { current, max };
};

/** True quando o valor deve ser exibido (0 e false contam como preenchidos). */
export const hasValue = (value: unknown): boolean =>
  value !== undefined && value !== null && value !== '';

/** Converte o texto de um input numérico, mantendo vazio como vazio. */
export const parseNumberInput = (raw: string): number | '' =>
  raw === '' || Number.isNaN(Number(raw)) ? '' : Number(raw);

export const getLogAuthor = (log: SessionLog) => log.author || 'Anônimo';

/**
 * Jogadores conhecidos: membros da campanha e autores de registros,
 * para o Mestre poder liberar NPCs e links antes da primeira sessão.
 */
export const getKnownPlayers = (logs: SessionLog[], members: string[] = []): string[] => {
  const players = new Set<string>(members);
  logs.forEach(log => players.add(getLogAuthor(log)));
  return Array.from(players).sort((a, b) => a.localeCompare(b));
};

/** Dados do gráfico de evolução para um jogador, com as sessões numeradas por jogador. */
export const buildChartData = (logs: SessionLog[], fields: CustomField[], player: string) => {
  const numericFields = fields.filter(f => f.type === FieldType.NUMBER || f.type === FieldType.RESOURCE);
  return logs
    .filter(log => getLogAuthor(log) === player)
    .sort((a, b) => a.timestamp - b.timestamp)
    .map((log, index) => {
      const point: Record<string, string | number> = {
        name: `Sessão ${index + 1}`,
        date: new Date(log.timestamp).toLocaleDateString('pt-BR'),
      };
      numericFields.forEach(field => {
        const val = log.data[field.id];
        if (field.type === FieldType.RESOURCE && val && typeof val === 'object') {
          point[field.label] = (val as ResourceValue).current || 0;
        } else {
          point[field.label] = Number(val) || 0;
        }
      });
      return point;
    });
};
