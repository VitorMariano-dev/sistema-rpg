import { supabase } from "../lib/supabase";
import { CustomField, FieldType } from "../types";

// As chamadas ao Gemini rodam na Netlify Function (netlify/functions/gemini.mts),
// assim a chave da API nunca chega ao navegador.
const callGemini = async <T>(action: string, payload: unknown): Promise<T> => {
  const { data: { session } } = await supabase.auth.getSession();
  const response = await fetch('/api/gemini', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session?.access_token || ''}`,
    },
    body: JSON.stringify({ action, payload }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || `Erro ${response.status}`);
  return body as T;
};

/**
 * Suggests a list of custom fields based on a campaign theme.
 */
export const suggestCampaignFields = async (theme: string): Promise<CustomField[]> => {
  try {
    const { fields } = await callGemini<{ fields: any[] }>('suggestFields', { theme });
    // Map to our internal structure with IDs
    return fields.map((f: any) => ({
      ...f,
      id: crypto.randomUUID(),
      type: f.type as FieldType,
    }));
  } catch (error) {
    console.error("Error generating fields:", error);
    return [];
  }
};

/**
 * Generates a narrative summary of a session log.
 */
export const summarizeSessionLog = async (logData: Record<string, any>, fields: CustomField[]): Promise<string> => {
  try {
    const { text } = await callGemini<{ text: string }>('summarizeSession', { logData, fields });
    return text;
  } catch (error) {
    console.error("Error summarizing session:", error);
    return "Erro ao gerar resumo.";
  }
};

/**
 * Generates NPC descriptions (True/GM and Public/Player).
 */
export const generateNPCDescriptions = async (npcName: string, context: string): Promise<{ gmDescription: string, publicDescription: string }> => {
  try {
    return await callGemini('npcDescriptions', { name: npcName, context });
  } catch (error) {
    console.error("Error generating NPC descriptions:", error);
    return { gmDescription: "Erro ao gerar.", publicDescription: "Erro ao gerar." };
  }
};

/**
 * Generates content for an in-game document/scroll/book.
 */
export const generateDocumentContent = async (keywords: string, type: 'DOC' | 'MAP' | 'OTHER' | 'DISCORD'): Promise<string> => {
  try {
    const { text } = await callGemini<{ text: string }>('documentContent', { keywords, type });
    return text;
  } catch (error) {
    console.error("Error generating doc content:", error);
    return "As letras parecem borradas. (Erro na IA)";
  }
};
