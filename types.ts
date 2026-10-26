export enum FieldType {
  TEXT = 'TEXT',
  TEXTAREA = 'TEXTAREA',
  NUMBER = 'NUMBER',
  CHECKBOX = 'CHECKBOX',
  RESOURCE = 'RESOURCE', // Novo tipo para Vida/Mana (Atual/Max)
}

export interface ResourceValue {
  current: number;
  max: number;
}

export interface CustomField {
  id: string;
  label: string;
  type: FieldType;
  placeholder?: string;
  description?: string;
}

// --- NOVOS TIPOS PARA NPC ---
export type NPCCategory = 'FRIENDLY' | 'HOSTILE' | 'DECEPTIVE';

export interface NPCStats {
  hp: ResourceValue;
  mp: ResourceValue;
}

export interface NPC {
  id: string;
  name: string;
  description: string; // Descrição do Mestre (Verdadeira)
  publicDescription: string; // Descrição para Jogadores (Falsa/Aparência)
  category: NPCCategory;
  notes?: string;
  stats: NPCStats;
  discoveredBy: string[]; // Lista de usernames que descobriram este NPC
}

// --- NOVOS TIPOS PARA RECURSOS E MOEDAS ---
export type ResourceType = 'EXTERNAL' | 'INTERNAL';
export type ResourceCategory = 'MAP' | 'DOC' | 'DISCORD' | 'OTHER';

export interface ExternalLink {
  id: string;
  title: string;
  category: ResourceCategory;
  type: ResourceType;
  
  // Se EXTERNAL
  url?: string;
  
  // Se INTERNAL
  content?: string;
  
  // Visibilidade
  isPublic: boolean;
  visibleTo: string[]; // Lista de usernames com acesso
}

export interface CurrencyType {
  id: string;
  name: string;
  weightPerUnit: number;
}

// --- NOVOS TIPOS PARA INVENTÁRIO ---
export type ItemCategory = 'GENERAL' | 'WEAPON' | 'ARMOR' | 'CONSUMABLE' | 'VALUABLE' | 'CURRENCY';

export interface InventoryItem {
  id: string;
  name: string;
  quantity: number;
  weight: number; // Peso unitário em kg
  category: ItemCategory;
  // Atributos específicos de armadura/arma
  defense?: number;
  durability?: number;
  maxDurability?: number;
  notes?: string;
}

export interface Equipment {
  head: string;
  chest: string;
  legs: string;
  feet: string;
}

export interface CharacterSheetState {
  inventory: InventoryItem[];
  equipment: Equipment;
  maxWeight: number;
}

export interface SessionData {
  // Campos dinâmicos + Dados fixos de ficha
  [key: string]: string | number | boolean | ResourceValue | InventoryItem[] | Equipment | any;
}

export interface SessionLog {
  id: string;
  timestamp: number;
  data: SessionData;
  summary?: string;
  author?: string; // Quem criou o log
}

export interface CampaignConfig {
  title: string;
  description: string;
  fields: CustomField[];
  npcs: NPC[]; // Lista de NPCs da campanha
  links?: ExternalLink[]; // Links externos (Mapas, Discord, etc)
  currencies?: CurrencyType[]; // Tipos de moedas configuradas
}

export type UserRole = 'GM' | 'PLAYER';

export interface User {
  id: string;
  username: string;
  role: UserRole; // Papel do usuário na campanha aberta
}

export interface CampaignSummary {
  id: string;
  title: string;
  description: string;
  role: UserRole;
}

export type ViewMode = 'dashboard' | 'gm-config' | 'gm-npcs' | 'player-log' | 'history' | 'gm-players' | 'player-npcs' | 'resources';