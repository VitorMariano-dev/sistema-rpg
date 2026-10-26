import { describe, expect, it } from 'vitest';
import { diffById, linkToRow, npcToRows, rowToLink, rowToLog, rowsToNpc } from '../services/campaignRepo';
import { ExternalLink, NPC } from '../types';

const npc: NPC = {
  id: 'n1',
  name: 'Strahd',
  description: 'Vampiro ancestral',
  publicDescription: 'Um nobre pálido',
  category: 'DECEPTIVE',
  stats: { hp: { current: 100, max: 100 }, mp: { current: 20, max: 20 } },
  discoveredBy: ['ana'],
};

describe('NPCs', () => {
  it('separa a descrição verdadeira em outra linha e reconstrói o NPC', () => {
    const { npc: row, secret } = npcToRows('c1', npc);
    expect(row).not.toHaveProperty('description');
    expect(secret).toEqual({ npc_id: 'n1', campaign_id: 'c1', description: 'Vampiro ancestral', notes: null });
    expect(rowsToNpc(row, secret)).toEqual({ ...npc, notes: undefined });
  });

  it('jogador recebe o NPC sem a descrição verdadeira', () => {
    const { npc: row } = npcToRows('c1', npc);
    expect(rowsToNpc(row).description).toBe('');
    expect(rowsToNpc(row).publicDescription).toBe('Um nobre pálido');
  });
});

describe('links', () => {
  it('converte ida e volta', () => {
    const link: ExternalLink = { id: 'l1', title: 'Mapa', category: 'MAP', type: 'EXTERNAL', url: 'https://x', isPublic: false, visibleTo: ['ana'] };
    expect(rowToLink(linkToRow('c1', link))).toEqual({ ...link, content: undefined });
  });
});

describe('rowToLog', () => {
  it('usa a data do banco e o nome do autor', () => {
    const log = rowToLog({ id: 's1', campaign_id: 'c1', author_name: 'ana', data: { xp: 1 }, summary: null, created_at: '2026-10-26T12:00:00Z' });
    expect(log).toEqual({ id: 's1', timestamp: Date.parse('2026-10-26T12:00:00Z'), data: { xp: 1 }, summary: undefined, author: 'ana' });
  });
});

describe('diffById', () => {
  it('encontra itens novos, alterados e removidos', () => {
    const prev = [{ id: 'a', v: 1 }, { id: 'b', v: 1 }, { id: 'c', v: 1 }];
    const next = [{ id: 'a', v: 1 }, { id: 'b', v: 2 }, { id: 'd', v: 1 }];
    expect(diffById(prev, next)).toEqual({ upserts: [{ id: 'b', v: 2 }, { id: 'd', v: 1 }], deletes: ['c'] });
  });

  it('não faz nada quando nada mudou', () => {
    const items = [{ id: 'a', v: 1 }];
    expect(diffById(items, [...items])).toEqual({ upserts: [], deletes: [] });
  });
});
