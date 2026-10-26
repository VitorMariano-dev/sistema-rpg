import { supabase } from './supabase';
import { CampaignConfig, CampaignSummary, ExternalLink, NPC, SessionLog, UserRole } from '../types';

// ---------------------------------------------------------------------------
// Linhas do banco
// ---------------------------------------------------------------------------

export interface CampaignRow {
  id: string;
  gm_id: string;
  title: string;
  description: string;
  fields: CampaignConfig['fields'];
  currencies: NonNullable<CampaignConfig['currencies']>;
  invite_code: string;
}

export interface NpcRow {
  id: string;
  campaign_id: string;
  name: string;
  public_description: string;
  category: NPC['category'];
  stats: NPC['stats'];
  discovered_by: string[];
}

export interface NpcSecretRow {
  npc_id: string;
  campaign_id: string;
  description: string;
  notes: string | null;
}

export interface LinkRow {
  id: string;
  campaign_id: string;
  title: string;
  category: ExternalLink['category'];
  type: ExternalLink['type'];
  url: string | null;
  content: string | null;
  is_public: boolean;
  visible_to: string[];
}

export interface SessionLogRow {
  id: string;
  campaign_id: string;
  author_name: string;
  data: SessionLog['data'];
  summary: string | null;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Conversões entre o formato do app e o do banco (puras, testadas)
// ---------------------------------------------------------------------------

export const npcToRows = (campaignId: string, npc: NPC): { npc: NpcRow; secret: NpcSecretRow } => ({
  npc: {
    id: npc.id,
    campaign_id: campaignId,
    name: npc.name,
    public_description: npc.publicDescription,
    category: npc.category,
    stats: npc.stats,
    discovered_by: npc.discoveredBy || [],
  },
  secret: {
    npc_id: npc.id,
    campaign_id: campaignId,
    description: npc.description,
    notes: npc.notes ?? null,
  },
});

export const rowsToNpc = (row: NpcRow, secret?: NpcSecretRow): NPC => ({
  id: row.id,
  name: row.name,
  publicDescription: row.public_description,
  // Jogadores não recebem a descrição verdadeira (RLS); usam a pública
  description: secret?.description ?? '',
  notes: secret?.notes ?? undefined,
  category: row.category,
  stats: row.stats,
  discoveredBy: row.discovered_by || [],
});

export const linkToRow = (campaignId: string, link: ExternalLink): LinkRow => ({
  id: link.id,
  campaign_id: campaignId,
  title: link.title,
  category: link.category,
  type: link.type,
  url: link.url ?? null,
  content: link.content ?? null,
  is_public: link.isPublic,
  visible_to: link.visibleTo || [],
});

export const rowToLink = (row: LinkRow): ExternalLink => ({
  id: row.id,
  title: row.title,
  category: row.category,
  type: row.type,
  url: row.url ?? undefined,
  content: row.content ?? undefined,
  isPublic: row.is_public,
  visibleTo: row.visible_to || [],
});

export const rowToLog = (row: SessionLogRow): SessionLog => ({
  id: row.id,
  timestamp: new Date(row.created_at).getTime(),
  data: row.data,
  summary: row.summary ?? undefined,
  author: row.author_name,
});

/** O que mudou numa lista identificada por id: itens novos/alterados e ids removidos. */
export const diffById = <T extends { id: string }>(prev: T[], next: T[]) => {
  const prevById = new Map(prev.map(item => [item.id, item]));
  const nextIds = new Set(next.map(item => item.id));
  return {
    upserts: next.filter(item => {
      const old = prevById.get(item.id);
      return !old || JSON.stringify(old) !== JSON.stringify(item);
    }),
    deletes: prev.filter(item => !nextIds.has(item.id)).map(item => item.id),
  };
};

// ---------------------------------------------------------------------------
// Acesso ao banco
// ---------------------------------------------------------------------------

const check = <T>({ data, error }: { data: T; error: { message: string } | null }): T => {
  if (error) throw new Error(error.message);
  return data;
};

export const signIn = async (email: string, password: string) => {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message === 'Invalid login credentials' ? 'E-mail ou senha incorretos.' : error.message);
};

/** Retorna true se a conta já está ativa, false se precisa confirmar o e-mail. */
export const signUp = async (email: string, password: string, username: string): Promise<boolean> => {
  const available = check(await supabase.rpc('username_available', { name: username }));
  if (!available) throw new Error('Esse nome de usuário já existe.');
  const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { username } } });
  if (error) throw new Error(error.message);
  return Boolean(data.session);
};

export const signOut = () => supabase.auth.signOut();

export const getMyUsername = async (userId: string): Promise<string> => {
  const row = check(await supabase.from('profiles').select('username').eq('id', userId).single());
  return (row as { username: string }).username;
};

export const listMyCampaigns = async (userId: string): Promise<CampaignSummary[]> => {
  const rows = check(await supabase
    .from('campaign_members')
    .select('role, campaigns(id, title)')
    .eq('user_id', userId)
    .order('joined_at', { ascending: false })) as unknown as Array<{ role: UserRole; campaigns: { id: string; title: string } | null }>;
  return rows
    .filter(r => r.campaigns)
    .map(r => ({ id: r.campaigns!.id, title: r.campaigns!.title, role: r.role }));
};

export const createCampaign = async (title: string): Promise<string> => {
  const row = check(await supabase.from('campaigns').insert({ title }).select('id').single());
  return (row as { id: string }).id;
};

export const joinCampaign = async (code: string): Promise<string> => {
  const { data, error } = await supabase.rpc('join_campaign', { code });
  if (error) throw new Error(error.message.includes('inválido') ? 'Código de convite inválido.' : error.message);
  return data as string;
};

export interface LoadedCampaign {
  config: CampaignConfig;
  inviteCode: string;
  role: UserRole;
  players: string[];
}

export const loadCampaign = async (campaignId: string, userId: string): Promise<LoadedCampaign> => {
  const campaign = check(await supabase.from('campaigns').select('*').eq('id', campaignId).single()) as CampaignRow;
  const isGM = campaign.gm_id === userId;

  const [npcs, secrets, links, members] = await Promise.all([
    supabase.from('npcs').select('*').eq('campaign_id', campaignId).order('created_at'),
    isGM
      ? supabase.from('npc_secrets').select('*').eq('campaign_id', campaignId)
      : Promise.resolve({ data: [] as NpcSecretRow[], error: null }),
    supabase.from('links').select('*').eq('campaign_id', campaignId).order('created_at'),
    loadPlayers(campaignId),
  ]);

  const secretById = new Map((check(secrets) as NpcSecretRow[]).map(s => [s.npc_id, s]));

  return {
    config: {
      title: campaign.title,
      description: campaign.description,
      fields: campaign.fields || [],
      currencies: campaign.currencies || [],
      npcs: (check(npcs) as NpcRow[]).map(row => rowsToNpc(row, secretById.get(row.id))),
      links: (check(links) as LinkRow[]).map(rowToLink),
    },
    inviteCode: campaign.invite_code,
    role: isGM ? 'GM' : 'PLAYER',
    players: members,
  };
};

/** Usernames dos jogadores (não Mestre) da campanha. */
export const loadPlayers = async (campaignId: string): Promise<string[]> => {
  const rows = check(await supabase
    .from('campaign_members')
    .select('role, profiles(username)')
    .eq('campaign_id', campaignId)) as unknown as Array<{ role: UserRole; profiles: { username: string } | null }>;
  return rows
    .filter(m => m.role === 'PLAYER' && m.profiles)
    .map(m => m.profiles!.username)
    .sort((a, b) => a.localeCompare(b));
};

/** Grava só o que mudou entre duas versões da configuração (apenas o Mestre chama). */
export const saveConfig = async (campaignId: string, prev: CampaignConfig, next: CampaignConfig) => {
  const tasks: Array<PromiseLike<{ error: { message: string } | null }>> = [];

  if (
    prev.title !== next.title ||
    prev.description !== next.description ||
    JSON.stringify(prev.fields) !== JSON.stringify(next.fields) ||
    JSON.stringify(prev.currencies || []) !== JSON.stringify(next.currencies || [])
  ) {
    tasks.push(supabase.from('campaigns').update({
      title: next.title,
      description: next.description,
      fields: next.fields,
      currencies: next.currencies || [],
    }).eq('id', campaignId));
  }

  const npcDiff = diffById(prev.npcs || [], next.npcs || []);
  if (npcDiff.upserts.length) {
    const rows = npcDiff.upserts.map(n => npcToRows(campaignId, n));
    // O NPC precisa existir antes do segredo (chave estrangeira)
    tasks.push(supabase.from('npcs').upsert(rows.map(r => r.npc)).then(async res => {
      if (res.error) return res;
      return supabase.from('npc_secrets').upsert(rows.map(r => r.secret));
    }));
  }
  if (npcDiff.deletes.length) {
    tasks.push(supabase.from('npcs').delete().in('id', npcDiff.deletes));
  }

  const linkDiff = diffById(prev.links || [], next.links || []);
  if (linkDiff.upserts.length) {
    tasks.push(supabase.from('links').upsert(linkDiff.upserts.map(l => linkToRow(campaignId, l))));
  }
  if (linkDiff.deletes.length) {
    tasks.push(supabase.from('links').delete().in('id', linkDiff.deletes));
  }

  const results = await Promise.all(tasks);
  const failed = results.find(r => r.error);
  if (failed?.error) throw new Error(failed.error.message);
};

export const loadLogs = async (campaignId: string): Promise<SessionLog[]> => {
  const rows = check(await supabase
    .from('session_logs')
    .select('*')
    .eq('campaign_id', campaignId)
    .order('created_at', { ascending: false })) as SessionLogRow[];
  return rows.map(rowToLog);
};

export const insertLog = async (campaignId: string, log: SessionLog): Promise<SessionLog> => {
  const row = check(await supabase
    .from('session_logs')
    .insert({ id: log.id, campaign_id: campaignId, data: log.data, summary: log.summary ?? null })
    .select('*')
    .single()) as SessionLogRow;
  return rowToLog(row);
};

export const deleteLog = async (id: string) => {
  check(await supabase.from('session_logs').delete().eq('id', id));
};

/** Avisa quando algo da campanha muda no banco (outro jogador, ou o Mestre). */
export const subscribeToCampaign = (
  campaignId: string,
  onConfigChange: () => void,
  onLogsChange: () => void,
  onMembersChange: () => void
) => {
  const filter = `campaign_id=eq.${campaignId}`;
  const channel = supabase
    .channel(`campaign-${campaignId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'campaigns', filter: `id=eq.${campaignId}` }, onConfigChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'npcs', filter }, onConfigChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'links', filter }, onConfigChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'session_logs', filter }, onLogsChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'campaign_members', filter }, onMembersChange)
    .subscribe();
  return () => { supabase.removeChannel(channel); };
};

// Dados antigos salvos no navegador (versão sem backend), para importar uma vez
export const readLegacyConfig = (): CampaignConfig | null => {
  try {
    const raw = localStorage.getItem('rpg_config');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

