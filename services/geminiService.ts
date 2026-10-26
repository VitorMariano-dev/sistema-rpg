import { CustomField, FieldType, ResourceValue } from "../types";

// As chamadas vão para o servidor (Netlify Function em produção, middleware do Vite em
// desenvolvimento), que guarda a chave do Gemini. Nenhuma chave fica no navegador.
export const GEMINI_ENDPOINT = '/.netlify/functions/gemini';

const callGemini = async <T>(payload: Record<string, unknown>): Promise<T> => {
  let response: Response;
  try {
    response = await fetch(GEMINI_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new Error('Não foi possível falar com o servidor da IA.');
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || 'Erro ao chamar a IA.');
  }
  return data.result as T;
};

/**
 * Suggests a list of custom fields based on a campaign theme.
 */
export const suggestCampaignFields = async (theme: string): Promise<CustomField[]> => {
  const rawFields = await callGemini<Array<Omit<CustomField, 'id'>>>({ action: 'suggestFields', theme });
  return (Array.isArray(rawFields) ? rawFields : []).map(f => ({
    ...f,
    id: crypto.randomUUID(),
    type: f.type as FieldType,
  }));
};

export const formatSessionData = (logData: Record<string, unknown>, fields: CustomField[]): string =>
  fields.map(field => {
    const value = logData[field.id];
    if (field.type === FieldType.RESOURCE && value && typeof value === 'object') {
      const res = value as ResourceValue;
      return `${field.label}: ${res.current}/${res.max}`;
    }
    if (typeof value === 'boolean') {
      return `${field.label}: ${value ? 'Sim' : 'Não'}`;
    }
    return `${field.label}: ${value ?? ''}`;
  }).join('\n');

/**
 * Generates a narrative summary of a session log. Throws if the AI is unavailable.
 */
export const summarizeSessionLog = async (logData: Record<string, unknown>, fields: CustomField[]): Promise<string> => {
  const formattedData = formatSessionData(logData, fields);
  if (!formattedData.trim()) return '';
  return callGemini<string>({ action: 'summarizeSession', formattedData });
};

/**
 * Generates NPC descriptions (True/GM and Public/Player). Throws if the AI is unavailable.
 */
export const generateNPCDescriptions = async (npcName: string, context: string): Promise<{ gmDescription: string, publicDescription: string }> => {
  const result = await callGemini<{ gmDescription?: string; publicDescription?: string }>({ action: 'npcDescriptions', npcName, context });
  return {
    gmDescription: result?.gmDescription || "",
    publicDescription: result?.publicDescription || ""
  };
};

/**
 * Generates content for an in-game document/scroll/book. Throws if the AI is unavailable.
 */
export const generateDocumentContent = async (keywords: string, type: 'DOC' | 'MAP' | 'OTHER' | 'DISCORD'): Promise<string> => {
  return callGemini<string>({ action: 'documentContent', keywords, type });
};
