import { GoogleGenAI, Type } from "@google/genai";
import { CustomField, FieldType, SessionLog, ResourceValue } from "../types";

// Initialize the Gemini AI client
// Safely try to retrieve API Key from Vite (import.meta.env) or Node/Process env
// This prevents "Cannot read properties of undefined (reading 'VITE_API_KEY')" errors
const getApiKey = () => {
  try {
    const meta = import.meta as any;
    if (meta && meta.env && meta.env.VITE_API_KEY) {
      return meta.env.VITE_API_KEY;
    }
  } catch (e) {
    // Ignore errors accessing import.meta
  }

  try {
    if (typeof process !== 'undefined' && process.env) {
      return process.env.API_KEY;
    }
  } catch (e) {
    // Ignore errors accessing process
  }

  return undefined;
};

const apiKey = getApiKey();

if (!apiKey) {
  console.warn("API Key is missing. AI features will not work.");
}

const ai = new GoogleGenAI({ apiKey: apiKey || '' });

const MODEL_NAME = 'gemini-2.5-flash';

/**
 * Suggests a list of custom fields based on a campaign theme.
 */
export const suggestCampaignFields = async (theme: string): Promise<CustomField[]> => {
  if (!apiKey) return [];
  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: `Estou construindo um sistema de registro de campanhas de RPG. O tema da minha campanha é: "${theme}". 
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

    const rawFields = JSON.parse(response.text || "[]");
    
    // Map to our internal structure with IDs
    return rawFields.map((f: any) => ({
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
  if (!apiKey) return "Erro: Chave de API não configurada.";
  try {
    // Construct a readable representation of the data
    const formattedData = fields.map(field => {
      const value = logData[field.id];
      if (field.type === FieldType.RESOURCE && typeof value === 'object') {
          const res = value as ResourceValue;
          return `${field.label}: ${res.current}/${res.max}`;
      }
      return `${field.label}: ${value}`;
    }).join('\n');

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: `Aqui estão os dados brutos de um registro de sessão de RPG. Escreva uma entrada de diário curta e dramática (máx. 150 palavras) resumindo esses eventos como se fossem escritos por um cronista, em Português do Brasil.\n\n${formattedData}`,
      config: {
        temperature: 0.8,
      }
    });

    return response.text || "Não foi possível gerar o resumo.";
  } catch (error) {
    console.error("Error summarizing session:", error);
    return "Erro ao gerar resumo.";
  }
};

/**
 * Generates NPC descriptions (True/GM and Public/Player).
 */
export const generateNPCDescriptions = async (npcName: string, context: string): Promise<{ gmDescription: string, publicDescription: string }> => {
  if (!apiKey) return { gmDescription: "Configure a API Key.", publicDescription: "Configure a API Key." };
  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: `Crie descrições para um NPC/Monstro de RPG chamado "${npcName}". Contexto extra: "${context}".
      
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

    const result = JSON.parse(response.text || "{}");
    return {
        gmDescription: result.gmDescription || "",
        publicDescription: result.publicDescription || ""
    };
  } catch (error) {
    console.error("Error generating NPC descriptions:", error);
    return { gmDescription: "Erro ao gerar.", publicDescription: "Erro ao gerar." };
  }
};

/**
 * Generates content for an in-game document/scroll/book.
 */
export const generateDocumentContent = async (keywords: string, type: 'DOC' | 'MAP' | 'OTHER' | 'DISCORD'): Promise<string> => {
  if (!apiKey) return "Configure a API Key para gerar conteúdo.";
  try {
    let prompt = `Escreva o texto curto (máx 200 palavras) de um documento de RPG de fantasia (como uma carta, um decreto real, ou página de diário). 
    Use as seguintes palavras-chaves/ideias: "${keywords}".
    O tom deve ser imersivo. Não inclua introduções fora do personagem.`;
    
    if (type === 'MAP') {
        prompt = `Descreva detalhadamente um mapa antigo ou uma localidade baseada nestas palavras-chaves: "${keywords}".`;
    }

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
    });

    return response.text || "O documento está ilegível...";
  } catch (error) {
    console.error("Error generating doc content:", error);
    return "As letras parecem borradas. (Erro na IA)";
  }
};