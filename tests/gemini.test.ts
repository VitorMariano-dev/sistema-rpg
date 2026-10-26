import { describe, expect, it } from 'vitest';
import { getApiKey, handleGeminiRequest, validateRequest } from '../server/gemini';

describe('getApiKey', () => {
  it('prefere GEMINI_API_KEY e aceita API_KEY por compatibilidade', () => {
    expect(getApiKey({ GEMINI_API_KEY: 'a', API_KEY: 'b' })).toBe('a');
    expect(getApiKey({ API_KEY: 'b' })).toBe('b');
    expect(getApiKey({})).toBe('');
  });
});

describe('validateRequest', () => {
  it('aceita ações válidas', () => {
    expect(validateRequest({ action: 'suggestFields', theme: 'Horror' })).toEqual({ action: 'suggestFields', theme: 'Horror' });
    expect(validateRequest({ action: 'documentContent', keywords: 'rei', type: 'MAP' })).toEqual({ action: 'documentContent', keywords: 'rei', type: 'MAP' });
  });

  it('rejeita ações desconhecidas ou incompletas', () => {
    expect(validateRequest(null)).toBeNull();
    expect(validateRequest({ action: 'apagarTudo' })).toBeNull();
    expect(validateRequest({ action: 'suggestFields', theme: '   ' })).toBeNull();
    expect(validateRequest({ action: 'documentContent', keywords: 'x', type: 'BOOK' })).toBeNull();
  });
});

describe('handleGeminiRequest', () => {
  it('responde 503 sem chave, sem quebrar', async () => {
    const result = await handleGeminiRequest({ action: 'suggestFields', theme: 'x' }, '');
    expect(result.status).toBe(503);
    expect(result.body.error).toMatch(/GEMINI_API_KEY/);
  });

  it('responde 400 para requisição inválida', async () => {
    const result = await handleGeminiRequest({ action: 'nada' }, 'chave');
    expect(result.status).toBe(400);
  });
});
