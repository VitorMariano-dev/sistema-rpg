import { GoogleGenAI, Type } from "@google/genai";
import { CustomField, FieldType, SessionLog, ResourceValue } from "../types";

// Initialize the Gemini AI client
// Note: We use process.env.API_KEY as per the requirements.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const MODEL_NAME = 'gemini-2.5-flash';

/**
 * Suggests a list of custom fields based on a campaign theme.
 */
export const suggestCampaignFields = async (theme: string): Promise<CustomField[]> => {
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