import { GoogleGenAI, Type } from "@google/genai";

// Toda chamada ao Gemini acontece aqui, no servidor (Netlify Function em produção,
// middleware do Vite em desenvolvimento), para que a chave nunca vá para o navegador.

const MODEL_NAME = 'gemini-2.5-flash';

export type GeminiAction =
  | { action: 'suggestFields'; theme: string }
  | { action: 'summarizeSession'; formattedData: string }
  | { action: 'npcDescriptions'; npcName: string; context: string }
  | { action: 'documentContent'; keywords: string; type: 'DOC' | 'MAP' | 'OTHER' | 'DISCORD' };

export interface GeminiResult {
  status: number;
  body: { result?: unknown; error?: string };
}

export const getApiKey = (env: Record<string, string | undefined>) =>
  env.GEMINI_API_KEY || env.API_KEY || '';

const isNonEmptyString = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;

export const validateRequest = (body: unknown): GeminiAction | null => {
  if (!body || typeof body !== 'object') return null;
  const b = body as Record<string, unknown>;
  switch (b.action) {
    case 'suggestFields':
      return isNonEmptyString(b.theme) ? { action: b.action, theme: b.theme } : null;
    case 'summarizeSession':
      return isNonEmptyString(b.formattedData) ? { action: b.action, formattedData: b.formattedData } : null;
    case 'npcDescriptions':
      return isNonEmptyString(b.npcName)
        ? { action: b.action, npcName: b.npcName, context: typeof b.context === 'string' ? b.context : '' }
        : null;
    case 'documentContent':
      return isNonEmptyString(b.keywords) && ['DOC', 'MAP', 'OTHER', 'DISCORD'].includes(b.type as string)
        ? { action: b.action, keywords: b.keywords, type: b.type as 'DOC' | 'MAP' | 'OTHER' | 'DISCORD' }
        : null;
    default:
      return null;
  }
};

const run = async (ai: GoogleGenAI, req: GeminiAction): Promise<unknown> => {
  switch (req.action) {
    case 'suggestFields': {
      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: `Estou construindo um sistema de registro de campanhas de RPG. O tema da minha campanha é: "${req.theme}".
      Gere uma lista de 5 a 8 campos de formulário personalizados em Português que os jogadores devem preencher após uma sessão.
      Inclua campos numéricos (como XP, Ouro) e campos de recurso (como Vida: 80/100, Mana) se apropriado.
      Para tipos de recursos (vida/mana/sanidade que tem máximo e atual), use o tipo RESOURCE.`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                label: { type: Type.STRING, description: "O rótulo do campo de entrada" },
                type: { type: Type.STRING, enum: ["TEXT", "TEXTAREA", "NUMBER", "CHECKBOX", "RESOURCE"], description: "O tipo de entrada" },
                placeholder: { type: Type.STRING, description: "Um texto curto de exemplo (placeholder)" },
                description: { type: Type.STRING, description: "Texto de ajuda para o jogador" },
              },
              required: ["label", "type"],
            },
          },
        },
      });
      return JSON.parse(response.text || "[]");
    }

    case 'summarizeSession': {
      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: `Aqui estão os dados brutos de um registro de sessão de RPG. Escreva uma entrada de diário curta e dramática (máx. 150 palavras) resumindo esses eventos como se fossem escritos por um cronista, em Português do Brasil.\n\n${req.formattedData}`,
        config: { temperature: 0.8 },
      });
      return response.text || '';
    }

    case 'npcDescriptions': {
      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: `Crie descrições para um NPC/Monstro de RPG chamado "${req.npcName}". Contexto extra: "${req.context}".

      Preciso de dois textos distintos em Português:
      1. Descrição Pública: O que os jogadores veem imediatamente (aparência, cheiro, equipamento visível). Não revele segredos ou intenções ocultas.
      2. Descrição do Mestre: A verdade sobre o NPC (personalidade, segredos, intenções reais, natureza mágica se houver).

      Retorne APENAS o JSON.`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              gmDescription: { type: Type.STRING, description: "A verdade oculta para o Mestre" },
              publicDescription: { type: Type.STRING, description: "A descrição visual para os jogadores" }
            },
            required: ["gmDescription", "publicDescription"]
          }
        }
      });
      return JSON.parse(response.text || "{}");
    }

    case 'documentContent': {
      let prompt = `Escreva o texto curto (máx 200 palavras) de um documento de RPG de fantasia (como uma carta, um decreto real, ou página de diário).
    Use as seguintes palavras-chaves/ideias: "${req.keywords}".
    O tom deve ser imersivo. Não inclua introduções fora do personagem.`;

      if (req.type === 'MAP') {
        prompt = `Descreva detalhadamente um mapa antigo ou uma localidade baseada nestas palavras-chaves: "${req.keywords}".`;
      }

      const response = await ai.models.generateContent({ model: MODEL_NAME, contents: prompt });
      return response.text || '';
    }
  }
};

/**
 * Processa uma requisição do cliente. Nunca lança erro: devolve status HTTP e corpo JSON.
 */
export const handleGeminiRequest = async (body: unknown, apiKey: string): Promise<GeminiResult> => {
  if (!apiKey) {
    return { status: 503, body: { error: 'A IA não está configurada no servidor (defina GEMINI_API_KEY).' } };
  }
  const req = validateRequest(body);
  if (!req) {
    return { status: 400, body: { error: 'Requisição inválida.' } };
  }
  try {
    const ai = new GoogleGenAI({ apiKey });
    return { status: 200, body: { result: await run(ai, req) } };
  } catch (error) {
    console.error('Gemini error:', error);
    return { status: 502, body: { error: 'A IA não conseguiu responder agora. Tente novamente.' } };
  }
};
