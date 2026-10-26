import { supabase } from '../lib/supabase';
import { CampaignConfig, CampaignSummary, ExternalLink, NPC, SessionLog, UserRole } from '../types';

export interface CampaignData {
  config: CampaignConfig;
  logs: SessionLog[];
  players: string[]; // Nomes de usuário dos jogadores da campanha
  role: UserRole;
  inviteCode: string;
}

const unwrap = <T>({ data, error }: { data: T; error: { message: string } | null }): T => {
  if (error) throw new Error(error.message);
  return data;
};

// --- Campanhas ---

export const listMyCampaigns = async (userId: string): Promise<CampaignSummary[]> => {
  const rows = unwrap(
    await supabase
      .from('campaign_members')
      .select('role, campaigns(id, title, description)')
      .eq('user_id', userId)
      .order('joined_at', { ascending: false })
  ) as any[];

  return rows
    .filter(r => r.campaigns)
    .map(r => ({
      id: r.campaigns.id,
      title: r.campaigns.title,
      description: r.campaigns.description,
      role: r.role as UserRole,
    }));
};

export const createCampaign = async (title: string, initial?: Partial<CampaignConfig>): Promise<string> => {
  const campaign = unwrap(
    await supabase
      .from('campaigns')
      .insert({
        title: title.trim() || 'Nova Campanha',
        description: initial?.description || '',
        fields: initial?.fields || [],
        currencies: initial?.currencies || [],
      })
      .select('id')
      .single()
  ) as { id: string };

  // Importação opcional de dados antigos (localStorage)
  if (initial?.npcs?.length || initial?.links?.length) {
    // Mesmos dados de campanha nos dois lados: só NPCs e links são gravados aqui
    const base = { title, description: '', fields: [], currencies: [] };
    await saveConfigChanges(
      campaign.id,
      { ...base, npcs: [], links: [] },
      { ...base, npcs: initial.npcs || [], links: initial.links || [] }
    );
  }
  return campaign.id;
};

export const joinCampaign = async (code: string): Promise<string> => {
  const { data, error } = await supabase.rpc('join_campaign', { code });
  if (error) throw new Error(error.message);
  return data as string;
};

export const leaveCampaign = async (campaignId: string, userId: string) => {
  unwrap(await supabase.from('campaign_members').delete().eq('campaign_id', campaignId).eq('user_id', userId));
};

// --- Carregamento completo de uma campanha ---

const rowToNPC = (row: any, secret?: any): NPC => ({
  id: row.id,
  name: row.name,
  publicDescription: row.public_description,
  description: secret?.description || '',
  notes: secret?.notes || undefined,
  category: row.category,
  stats: {
    hp: row.stats?.hp || { current: 0, max: 0 },
    mp: row.stats?.mp || { current: 0, max: 0 },
  },
  discoveredBy: row.discovered_by || [],
});

const rowToLink = (row: any): ExternalLink => ({
  id: row.id,
  title: row.title,
  category: row.category,
  type: row.type,
  url: row.url || undefined,
  content: row.content || undefined,
  isPublic: row.is_public,
  visibleTo: row.visible_to || [],
});

const rowToLog = (row: any): SessionLog => ({
  id: row.id,
  timestamp: new Date(row.created_at).getTime(),
  data: row.data || {},
  summary: row.summary || undefined,
  author: row.author,
});

export const loadCampaign = async (campaignId: string, userId: string): Promise<CampaignData> => {
  const [campaign, membership, members, npcs, links, logs] = await Promise.all([
    supabase.from('campaigns').select('*').eq('id', campaignId).single(),
    supabase.from('campaign_members').select('role').eq('campaign_id', campaignId).eq('user_id', userId).single(),
    supabase.from('campaign_members').select('role, user_id').eq('campaign_id', campaignId),
    supabase.from('npcs').select('*').eq('campaign_id', campaignId).order('created_at'),
    supabase.from('campaign_links').select('*').eq('campaign_id', campaignId).order('created_at'),
    supabase.from('session_logs').select('*').eq('campaign_id', campaignId).order('created_at', { ascending: false }),
  ]);

  const c = unwrap(campaign) as any;
  const role = (unwrap(membership) as any).role as UserRole;

  // Segredos dos NPCs: a política do banco só devolve linhas para o Mestre
  const secrets = role === 'GM'
    ? (unwrap(await supabase.from('npc_secrets').select('*').eq('campaign_id', campaignId)) as any[])
    : [];
  const secretById = new Map(secrets.map(s => [s.npc_id, s]));

  const playerIds = (unwrap(members) as any[]).filter(m => m.role === 'PLAYER').map(m => m.user_id);
  const profiles = playerIds.length
    ? (unwrap(await supabase.from('profiles').select('username').in('id', playerIds)) as any[])
    : [];

  return {
    role,
    inviteCode: c.invite_code,
    players: profiles.map(p => p.username).sort((a, b) => a.localeCompare(b)),
    config: {
      title: c.title,
      description: c.description,
      fields: c.fields || [],
      currencies: c.currencies || [],
      npcs: (unwrap(npcs) as any[]).map(n => rowToNPC(n, secretById.get(n.id))),
      links: (unwrap(links) as any[]).map(rowToLink),
    },
    logs: (unwrap(logs) as any[]).map(rowToLog),
  };
};

// --- Gravação da configuração (só o Mestre) ---
// Os componentes trabalham com o objeto CampaignConfig inteiro; aqui comparamos
// a versão anterior com a nova e gravamos só o que mudou.

const changed = (a: unknown, b: unknown) => JSON.stringify(a) !== JSON.stringify(b);

export const saveConfigChanges = async (campaignId: string, prev: CampaignConfig, next: CampaignConfig) => {
  const tasks: PromiseLike<any>[] = [];

  if (
    prev.title !== next.title ||
    prev.description !== next.description ||
    changed(prev.fields, next.fields) ||
    changed(prev.currencies || [], next.currencies || [])
  ) {
    tasks.push(
      supabase.from('campaigns').update({
        title: next.title,
        description: next.description,
        fields: next.fields,
        currencies: next.currencies || [],
      }).eq('id', campaignId)
    );
  }

  // NPCs
  const prevNpcs = new Map((prev.npcs || []).map(n => [n.id, n]));
  const nextNpcs = next.npcs || [];
  const upsertNpcs = nextNpcs.filter(n => !prevNpcs.has(n.id) || changed(prevNpcs.get(n.id), n));
  const removedNpcs = [...prevNpcs.keys()].filter(id => !nextNpcs.some(n => n.id === id));

  if (upsertNpcs.length) {
    // Os segredos dependem da linha do NPC, então gravamos em sequência
    tasks.push(
      supabase.from('npcs').upsert(upsertNpcs.map(n => ({
        id: n.id,
        campaign_id: campaignId,
        name: n.name,
        public_description: n.publicDescription,
        category: n.category,
        stats: n.stats,
        discovered_by: n.discoveredBy || [],
      }))).then(res => {
        if (res.error) return res;
        return supabase.from('npc_secrets').upsert(upsertNpcs.map(n => ({
          npc_id: n.id,
          campaign_id: campaignId,
          description: n.description,
          notes: n.notes || null,
        })));
      })
    );
  }
  if (removedNpcs.length) {
    tasks.push(supabase.from('npcs').delete().in('id', removedNpcs));
  }

  // Links
  const prevLinks = new Map((prev.links || []).map(l => [l.id, l]));
  const nextLinks = next.links || [];
  const upsertLinks = nextLinks.filter(l => !prevLinks.has(l.id) || changed(prevLinks.get(l.id), l));
  const removedLinks = [...prevLinks.keys()].filter(id => !nextLinks.some(l => l.id === id));

  if (upsertLinks.length) {
    tasks.push(
      supabase.from('campaign_links').upsert(upsertLinks.map(l => ({
        id: l.id,
        campaign_id: campaignId,
        title: l.title,
        category: l.category,
        type: l.type,
        url: l.url || null,
        content: l.content || null,
        is_public: l.isPublic,
        visible_to: l.visibleTo || [],
      })))
    );
  }
  if (removedLinks.length) {
    tasks.push(supabase.from('campaign_links').delete().in('id', removedLinks));
  }

  const results = await Promise.all(tasks);
  const failed = results.find(r => r?.error);
  if (failed) throw new Error(failed.error.message);
};

// --- Registros de sessão ---

export const insertSessionLog = async (campaignId: string, log: SessionLog): Promise<SessionLog> => {
  const row = unwrap(
    await supabase
      .from('session_logs')
      .insert({
        id: log.id,
        campaign_id: campaignId,
        author: log.author,
        data: log.data,
        summary: log.summary || null,
      })
      .select('*')
      .single()
  );
  return rowToLog(row);
};

export const deleteSessionLog = async (logId: string) => {
  unwrap(await supabase.from('session_logs').delete().eq('id', logId));
};

// --- Tempo real ---

const REALTIME_TABLES = ['campaigns', 'campaign_members', 'npcs', 'npc_secrets', 'campaign_links', 'session_logs'];

export const subscribeToCampaign = (campaignId: string, onChange: () => void) => {
  const channel = supabase.channel(`campaign-${campaignId}`);
  REALTIME_TABLES.forEach(table => {
    const filter = table === 'campaigns' ? `id=eq.${campaignId}` : `campaign_id=eq.${campaignId}`;
    channel.on('postgres_changes', { event: '*', schema: 'public', table, filter }, onChange);
  });
  channel.subscribe();
  return () => { supabase.removeChannel(channel); };
};
