import { describe, expect, it } from 'vitest';
import { buildChartData, getKnownPlayers, hasValue, parseNumberInput, updateResource } from '../utils';
import { CustomField, FieldType, SessionLog } from '../types';

describe('updateResource', () => {
  it('aceita o valor atual antes de definir o máximo', () => {
    expect(updateResource(undefined, 'current', 30)).toEqual({ current: 30, max: 0 });
  });

  it('limita o atual ao máximo quando há máximo', () => {
    expect(updateResource({ current: 0, max: 50 }, 'current', 80)).toEqual({ current: 50, max: 50 });
    expect(updateResource({ current: 40, max: 50 }, 'max', 20)).toEqual({ current: 20, max: 20 });
  });

  it('trata entrada inválida como zero', () => {
    expect(updateResource({ current: 5, max: 10 }, 'current', NaN)).toEqual({ current: 0, max: 10 });
  });
});

describe('hasValue', () => {
  it('considera 0 e false como preenchidos', () => {
    expect(hasValue(0)).toBe(true);
    expect(hasValue(false)).toBe(true);
    expect(hasValue('')).toBe(false);
    expect(hasValue(undefined)).toBe(false);
    expect(hasValue(null)).toBe(false);
  });
});

describe('parseNumberInput', () => {
  it('converte números e mantém vazio', () => {
    expect(parseNumberInput('12')).toBe(12);
    expect(parseNumberInput('0')).toBe(0);
    expect(parseNumberInput('')).toBe('');
  });
});

const log = (author: string | undefined, timestamp: number, data: SessionLog['data']): SessionLog => ({
  id: `${author}-${timestamp}`, author, timestamp, data,
});

describe('getKnownPlayers', () => {
  it('junta membros da campanha e autores de registros, sem repetir', () => {
    const logs = [log('bruno', 1, {}), log('ana', 2, {}), log(undefined, 3, {})];
    expect(getKnownPlayers(logs, ['ana'])).toEqual(['ana', 'Anônimo', 'bruno']);
  });
});

describe('buildChartData', () => {
  const fields: CustomField[] = [
    { id: 'xp', label: 'XP', type: FieldType.NUMBER },
    { id: 'hp', label: 'Vida', type: FieldType.RESOURCE },
    { id: 'nota', label: 'Nota', type: FieldType.TEXT },
  ];

  it('numera as sessões por jogador em ordem cronológica', () => {
    const logs = [
      log('ana', 300, { xp: 30, hp: { current: 5, max: 10 } }),
      log('bruno', 200, { xp: 99 }),
      log('ana', 100, { xp: '10', hp: { current: 8, max: 10 } }),
    ];
    const data = buildChartData(logs, fields, 'ana');
    expect(data.map(d => d.name)).toEqual(['Sessão 1', 'Sessão 2']);
    expect(data.map(d => d.XP)).toEqual([10, 30]);
    expect(data.map(d => d.Vida)).toEqual([8, 5]);
    expect(data[0]).not.toHaveProperty('Nota');
  });
});
