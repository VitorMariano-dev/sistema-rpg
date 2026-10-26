import React, { useState, useEffect, useRef, useCallback, Suspense, lazy } from 'react';
import { Scroll, Settings, History, LayoutDashboard, Feather, LogOut, Users, Skull, BookOpen, Map, Loader2, Repeat, KeyRound } from 'lucide-react';
import { CampaignConfig, SessionLog, ViewMode, User, FieldType, ResourceValue } from './types';
import Auth from './components/Auth';
import CampaignPicker from './components/CampaignPicker';
import { hasValue } from './utils';
import { isSupabaseConfigured, supabase } from './services/supabase';
import * as repo from './services/campaignRepo';

// Telas carregadas sob demanda para reduzir o tamanho do carregamento inicial
const FieldBuilder = lazy(() => import('./components/FieldBuilder'));
const SessionLogger = lazy(() => import('./components/SessionLogger'));
const CampaignAnalytics = lazy(() => import('./components/CampaignAnalytics'));
const PlayerInspector = lazy(() => import('./components/PlayerInspector'));
const NPCManager = lazy(() => import('./components/NPCManager'));
const KnownNPCs = lazy(() => import('./components/KnownNPCs'));
const ResourceList = lazy(() => import('./components/ResourceList'));

const CAMPAIGN_KEY = 'rpg_campaign';
const SAVE_DELAY_MS = 700;

const readStoredCampaign = () => {
  try { return localStorage.getItem(CAMPAIGN_KEY); } catch { return null; }
};
const storeCampaign = (id: string | null) => {
  try {
    if (id) localStorage.setItem(CAMPAIGN_KEY, id); else localStorage.removeItem(CAMPAIGN_KEY);
  } catch { /* sem armazenamento local: só não lembra a última campanha */ }
};

const FullScreenMessage: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="min-h-screen flex items-center justify-center p-6 bg-slate-950 text-slate-300 text-center">
    <div className="max-w-md space-y-4">{children}</div>
  </div>
);

const App: React.FC = () => {
  // --- Sessão e campanha ---
  const [authReady, setAuthReady] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [username, setUsername] = useState<string>('');
  const [campaignId, setCampaignId] = useState<string | null>(readStoredCampaign);
  const [view, setView] = useState<ViewMode>('dashboard');

  // --- Dados da campanha aberta ---
  const [config, setConfig] = useState<CampaignConfig | null>(null);
  const [role, setRole] = useState<User['role']>('PLAYER');
  const [inviteCode, setInviteCode] = useState('');
  const [players, setPlayers] = useState<string[]>([]);
  const [logs, setLogs] = useState<SessionLog[]>([]);
  const [loadError, setLoadError] = useState('');

  // Última versão gravada no banco e gravação pendente (o Mestre edita e salvamos em lote)
  const savedConfigRef = useRef<CampaignConfig | null>(null);
  const latestConfigRef = useRef<CampaignConfig | null>(null);
  const saveTimerRef = useRef<number | undefined>(undefined);

  const currentUser: User | null = userId ? { id: userId, username, role } : null;
  const roleRef = useRef(role);
  roleRef.current = role;

  // Acompanha login/logout do Supabase
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    supabase.auth.getSession().then(({ data }) => {
      setUserId(data.session?.user.id ?? null);
      setAuthReady(true);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user.id ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!userId) { setUsername(''); return; }
    repo.getMyUsername(userId).then(setUsername).catch(() => setUsername(''));
  }, [userId]);

  const reloadCampaign = useCallback(async () => {
    if (!campaignId || !userId) return;
    try {
      const loaded = await repo.loadCampaign(campaignId, userId);
      savedConfigRef.current = loaded.config;
      latestConfigRef.current = loaded.config;
      setConfig(loaded.config);
      setRole(loaded.role);
      setInviteCode(loaded.inviteCode);
      setPlayers(loaded.players);
      setLoadError('');
    } catch (err) {
      setLoadError((err as Error).message);
    }
  }, [campaignId, userId]);

  const reloadLogs = useCallback(async () => {
    if (!campaignId) return;
    try {
      setLogs(await repo.loadLogs(campaignId));
    } catch (err) {
      console.error('Erro ao carregar registros:', err);
    }
  }, [campaignId]);

  const reloadPlayers = useCallback(async () => {
    if (!campaignId) return;
    try {
      setPlayers(await repo.loadPlayers(campaignId));
    } catch (err) {
      console.error('Erro ao carregar jogadores:', err);
    }
  }, [campaignId]);

  // Carrega a campanha aberta e escuta mudanças em tempo real
  useEffect(() => {
    if (!campaignId || !userId) return;
    setConfig(null);
    setLogs([]);
    setView('dashboard');
    reloadCampaign();
    reloadLogs();
    return repo.subscribeToCampaign(
      campaignId,
      () => {
        // As mudanças de configuração do Mestre vêm dele mesmo; só os jogadores recarregam
        if (savedConfigRef.current && roleRef.current !== 'GM') reloadCampaign();
      },
      reloadLogs,
      reloadPlayers
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId, userId]);

  const flushSave = useCallback(async () => {
    window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = undefined;
    const prev = savedConfigRef.current;
    const next = latestConfigRef.current;
    if (!campaignId || !prev || !next || prev === next) return;
    try {
      await repo.saveConfig(campaignId, prev, next);
      savedConfigRef.current = next;
    } catch (err) {
      alert(`Não foi possível salvar a campanha: ${(err as Error).message}`);
      reloadCampaign();
    }
  }, [campaignId, reloadCampaign]);

  const handleUpdateConfig = (next: CampaignConfig) => {
    setConfig(next);
    latestConfigRef.current = next;
    window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(flushSave, SAVE_DELAY_MS);
  };

  // Grava o que estiver pendente antes de fechar a página
  useEffect(() => {
    const onUnload = () => { if (saveTimerRef.current) flushSave(); };
    window.addEventListener('beforeunload', onUnload);
    return () => window.removeEventListener('beforeunload', onUnload);
  }, [flushSave]);

  // Jogadores podem entrar a qualquer momento: o Mestre recarrega a lista ao abrir as telas que a usam
  useEffect(() => {
    if (role === 'GM' && (view === 'gm-config' || view === 'gm-npcs' || view === 'gm-players')) reloadPlayers();
  }, [view, role, reloadPlayers]);

  // --- Handlers ---
  const handleSelectCampaign = (id: string | null) => {
    if (saveTimerRef.current) flushSave();
    storeCampaign(id);
    setCampaignId(id);
  };

  const handleLogout = async () => {
    if (saveTimerRef.current) await flushSave();
    handleSelectCampaign(null);
    await repo.signOut();
  };

  const handleSaveLog = async (log: SessionLog) => {
    if (!campaignId) return;
    const saved = await repo.insertLog(campaignId, log);
    setLogs(prev => [saved, ...prev.filter(l => l.id !== saved.id)]);
  };

  const handleDeleteLog = async (id: string) => {
      if (!confirm('Excluir este registro de sessão?')) return;
      try {
          await repo.deleteLog(id);
          setLogs(prev => prev.filter(l => l.id !== id));
      } catch (err) {
          alert(`Não foi possível excluir: ${(err as Error).message}`);
      }
  };

  // Helper to render log values
  const renderLogValue = (fieldId: string, value: any, type: FieldType) => {
      if (type === FieldType.RESOURCE && typeof value === 'object') {
          const res = value as ResourceValue;
          return <span className="font-mono text-amber-400">{res.current} <span className="text-slate-500">/</span> {res.max}</span>;
      }
      if (type === FieldType.CHECKBOX || typeof value === 'boolean') {
          return value ? 'Sim' : 'Não';
      }
      return value;
  };

  // --- Security Check ---
  // Ensure players can't access GM views via state manipulation bugs
  useEffect(() => {
     if (currentUser?.role === 'PLAYER' && (view === 'gm-config' || view === 'gm-players' || view === 'gm-npcs')) {
         setView('dashboard');
     }
  }, [view, currentUser?.role]);

  // --- Main Content Render ---
  const renderContent = () => {
    if (!config) return null;
    switch (view) {
      case 'dashboard':
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto">
             <div className="col-span-1 md:col-span-2 text-center py-10">
                <h1 className="text-5xl font-bold cinzel text-amber-500 mb-4 drop-shadow-md">{config.title || 'Crônicas de Mesa'}</h1>
                <p className="text-xl text-slate-400">
                    Bem-vindo, {currentUser?.username}. 
                    <span className="ml-2 text-xs uppercase tracking-widest border border-slate-700 rounded px-2 py-0.5 text-slate-500">
                        {currentUser?.role === 'GM' ? 'Mestre' : 'Jogador'}
                    </span>
                </p>
             </div>

             {/* GM Only: Config Button */}
             {currentUser?.role === 'GM' && (
                <>
                    <div className="col-span-1 md:col-span-2 bg-slate-900/60 border border-purple-900/40 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-2">
                        <span className="text-slate-400 text-sm flex items-center gap-2">
                            <KeyRound className="w-4 h-4 text-purple-400" /> Código de convite para os jogadores entrarem nesta campanha:
                        </span>
                        <span className="font-mono text-xl tracking-widest text-purple-300 select-all">{inviteCode}</span>
                    </div>
                    <button onClick={() => setView('gm-config')} className="group relative overflow-hidden bg-slate-900 border border-slate-800 p-8 rounded-2xl hover:border-amber-500/50 transition-all text-left">
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                            <Settings className="w-24 h-24 text-amber-500" />
                        </div>
                        <h3 className="text-2xl font-bold text-slate-200 mb-2 cinzel group-hover:text-amber-500 transition-colors">Configurar Campanha</h3>
                        <p className="text-slate-500">Definir regras, criar links e economia.</p>
                    </button>

                    <button onClick={() => setView('gm-npcs')} className="group relative overflow-hidden bg-slate-900 border border-slate-800 p-8 rounded-2xl hover:border-red-500/50 transition-all text-left">
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                            <Skull className="w-24 h-24 text-red-500" />
                        </div>
                        <h3 className="text-2xl font-bold text-slate-200 mb-2 cinzel group-hover:text-red-500 transition-colors">Bestiário & NPCs</h3>
                        <p className="text-slate-500">Gerenciar status e visibilidade dos NPCs.</p>
                    </button>

                    <button onClick={() => setView('gm-players')} className="group relative overflow-hidden bg-slate-900 border border-slate-800 p-8 rounded-2xl hover:border-blue-500/50 transition-all text-left">
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                            <Users className="w-24 h-24 text-blue-500" />
                        </div>
                        <h3 className="text-2xl font-bold text-slate-200 mb-2 cinzel group-hover:text-blue-500 transition-colors">Inspecionar Jogadores</h3>
                        <p className="text-slate-500">Ver fichas atuais e histórico de todos os jogadores.</p>
                    </button>
                </>
             )}

             <button onClick={() => setView('player-log')} className="group relative overflow-hidden bg-slate-900 border border-slate-800 p-8 rounded-2xl hover:border-emerald-500/50 transition-all text-left">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                    <Feather className="w-24 h-24 text-emerald-500" />
                </div>
                <h3 className="text-2xl font-bold text-slate-200 mb-2 cinzel group-hover:text-emerald-500 transition-colors">Diário & Ficha</h3>
                <p className="text-slate-500">Registre notas, atualize inventário e equipamentos.</p>
             </button>

             <button onClick={() => setView('player-npcs')} className="group relative overflow-hidden bg-slate-900 border border-slate-800 p-8 rounded-2xl hover:border-orange-500/50 transition-all text-left">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                    <BookOpen className="w-24 h-24 text-orange-500" />
                </div>
                <h3 className="text-2xl font-bold text-slate-200 mb-2 cinzel group-hover:text-orange-500 transition-colors">Bestiário Conhecido</h3>
                <p className="text-slate-500">Criaturas e NPCs descobertos.</p>
             </button>

             <button onClick={() => setView('resources')} className="group relative overflow-hidden bg-slate-900 border border-slate-800 p-8 rounded-2xl hover:border-cyan-500/50 transition-all text-left">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                    <Map className="w-24 h-24 text-cyan-500" />
                </div>
                <h3 className="text-2xl font-bold text-slate-200 mb-2 cinzel group-hover:text-cyan-500 transition-colors">Links & Mapas</h3>
                <p className="text-slate-500">Acesse recursos externos da campanha.</p>
             </button>

             <button onClick={() => setView('history')} className="col-span-1 md:col-span-2 group relative overflow-hidden bg-slate-900 border border-slate-800 p-8 rounded-2xl hover:border-purple-500/50 transition-all text-left flex flex-col md:flex-row items-center gap-6">
                 <div className="flex-1">
                    <h3 className="text-2xl font-bold text-slate-200 mb-2 cinzel group-hover:text-purple-500 transition-colors">Os Arquivos</h3>
                    <p className="text-slate-500">Veja todos os registros de sessões e análises da campanha.</p>
                 </div>
                 <History className="w-12 h-12 text-slate-700 group-hover:text-purple-500 transition-colors" />
             </button>

             {/* Inline quick stats */}
             <div className="col-span-1 md:col-span-2">
                 <CampaignAnalytics logs={logs} fields={config.fields} currentUser={currentUser?.username} />
             </div>
          </div>
        );

      case 'gm-config':
        // Double check permissions in render
        if (currentUser?.role !== 'GM') return <div className="p-10 text-center text-red-500">Acesso Negado</div>;
        return <FieldBuilder config={config} onUpdateConfig={handleUpdateConfig} players={players} logs={logs} />;
      
      case 'gm-players':
        if (currentUser?.role !== 'GM') return <div className="p-10 text-center text-red-500">Acesso Negado</div>;
        return <PlayerInspector logs={logs} fields={config.fields} />;
      
      case 'gm-npcs':
        if (currentUser?.role !== 'GM') return <div className="p-10 text-center text-red-500">Acesso Negado</div>;
        return <NPCManager config={config} onUpdateConfig={handleUpdateConfig} players={players} logs={logs} />;

      case 'player-log':
        return <SessionLogger config={config} logs={logs} onSaveLog={handleSaveLog} currentUser={currentUser?.username || 'Anônimo'} />;

      case 'player-npcs':
        return <KnownNPCs config={config} currentUser={currentUser?.username || ''} />;

      case 'resources':
        return <ResourceList config={config} currentUser={currentUser} />;
      
      case 'history':
        return (
          <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
            <h2 className="text-3xl font-bold text-slate-200 cinzel mb-6 flex items-center gap-3">
                <History className="w-8 h-8 text-purple-500" /> Arquivos da Sessão
            </h2>

            {logs.length === 0 && (
                <div className="text-center py-20 bg-slate-900/50 rounded-xl border border-slate-800">
                    <p className="text-slate-500">Os arquivos estão vazios.</p>
                    <button onClick={() => setView('player-log')} className="mt-4 text-amber-500 hover:underline">Escreva a primeira entrada</button>
                </div>
            )}

            {logs.map((log) => (
              <div key={log.id} className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg hover:shadow-purple-900/10 transition-shadow">
                {/* Header */}
                <div className="bg-slate-950 p-4 border-b border-slate-800 flex justify-between items-center">
                    <div className="flex flex-col">
                        <span className="text-purple-400 font-mono text-sm">
                            {new Date(log.timestamp).toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                        </span>
                        {log.author && <span className="text-xs text-slate-500">por {log.author}</span>}
                    </div>
                    {/* Only author or GM can delete */}
                    {(currentUser?.role === 'GM' || currentUser?.username === log.author) && (
                        <button onClick={() => handleDeleteLog(log.id)} className="text-xs text-red-900 hover:text-red-500 px-2 py-1 rounded">Excluir</button>
                    )}
                </div>
                
                {/* Content */}
                <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Summary Column */}
                    <div className="lg:col-span-2">
                        {log.summary && (
                            <div className="mb-6 p-4 bg-purple-950/20 border-l-4 border-purple-600 rounded-r-lg">
                                <h4 className="text-purple-300 text-sm font-bold uppercase tracking-wider mb-2">O Resumo do Cronista</h4>
                                <p className="text-slate-300 italic font-serif leading-relaxed">"{log.summary}"</p>
                            </div>
                        )}
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {config.fields.map(field => {
                                // Only show non-empty fields
                                if (!hasValue(log.data[field.id])) return null;
                                return (
                                    <div key={field.id} className="bg-slate-950/50 p-3 rounded border border-slate-800/50">
                                        <span className="text-xs text-slate-500 uppercase block mb-1">{field.label}</span>
                                        <span className="text-slate-200">
                                            {renderLogValue(field.id, log.data[field.id], field.type)}
                                        </span>
                                    </div>
                                )
                            })}
                        </div>
                    </div>

                    {/* Visual Decor (Placeholder) */}
                    <div className="hidden lg:block lg:col-span-1">
                        <div className="h-full w-full rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-center p-4 relative overflow-hidden">
                            <img 
                                src={`https://picsum.photos/seed/${log.id}/400/600`} 
                                alt="Session Atmosphere" 
                                className="absolute inset-0 w-full h-full object-cover opacity-40 mix-blend-overlay"
                            />
                            <div className="relative z-10 text-center">
                                <Scroll className="w-12 h-12 text-slate-600 mx-auto mb-2" />
                                <span className="text-xs text-slate-500 tracking-widest uppercase">Artefato da Sessão</span>
                            </div>
                        </div>
                    </div>
                </div>
              </div>
            ))}
          </div>
        );
    }
  };

  // --- Telas antes da campanha aberta ---
  if (!isSupabaseConfigured) {
      return (
          <FullScreenMessage>
              <h1 className="text-2xl font-bold text-amber-500 cinzel">Banco de dados não configurado</h1>
              <p>Defina <code className="text-amber-300">VITE_SUPABASE_URL</code> e <code className="text-amber-300">VITE_SUPABASE_ANON_KEY</code> no arquivo <code>.env.local</code> (ou nas variáveis de ambiente do Netlify) e gere o app de novo.</p>
          </FullScreenMessage>
      );
  }

  if (!authReady) {
      return <FullScreenMessage><Loader2 className="w-8 h-8 animate-spin mx-auto text-amber-500" /></FullScreenMessage>;
  }

  if (!currentUser) {
      return <Auth />;
  }

  if (!campaignId) {
      return <CampaignPicker userId={currentUser.id} username={username} onSelect={handleSelectCampaign} onLogout={handleLogout} />;
  }

  if (!config) {
      return (
          <FullScreenMessage>
              {loadError ? (
                  <>
                      <p className="text-red-400">Não foi possível abrir a campanha: {loadError}</p>
                      <button onClick={() => handleSelectCampaign(null)} className="text-amber-500 hover:underline">Voltar para suas campanhas</button>
                  </>
              ) : (
                  <Loader2 className="w-8 h-8 animate-spin mx-auto text-amber-500" />
              )}
          </FullScreenMessage>
      );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black text-slate-200">
      
      {/* Navigation Bar */}
      <nav className="border-b border-slate-800 bg-slate-950/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center gap-3 cursor-pointer" onClick={() => setView('dashboard')}>
              <div className="bg-amber-600 p-2 rounded-lg">
                <Scroll className="h-6 w-6 text-white" />
              </div>
              <span className="font-bold text-xl cinzel tracking-wide text-slate-100 hidden sm:block">Crônicas</span>
            </div>
            
            <div className="flex items-center space-x-1 sm:space-x-2 overflow-x-auto">
              <NavButton 
                active={view === 'dashboard'} 
                onClick={() => setView('dashboard')} 
                icon={<LayoutDashboard className="w-4 h-4" />} 
                label="Início" 
              />
              
              {/* Conditional Nav Buttons */}
              {currentUser.role === 'GM' && (
                  <>
                    <NavButton 
                        active={view === 'gm-config'} 
                        onClick={() => setView('gm-config')} 
                        icon={<Settings className="w-4 h-4" />} 
                        label="Campanha" 
                    />
                     <NavButton 
                        active={view === 'gm-npcs'} 
                        onClick={() => setView('gm-npcs')} 
                        icon={<Skull className="w-4 h-4" />} 
                        label="NPCs" 
                    />
                     <NavButton 
                        active={view === 'gm-players'} 
                        onClick={() => setView('gm-players')} 
                        icon={<Users className="w-4 h-4" />} 
                        label="Jogadores" 
                    />
                  </>
              )}

              <NavButton 
                active={view === 'player-log'} 
                onClick={() => setView('player-log')} 
                icon={<Feather className="w-4 h-4" />} 
                label="Diário" 
              />

              <NavButton 
                active={view === 'player-npcs'} 
                onClick={() => setView('player-npcs')} 
                icon={<BookOpen className="w-4 h-4" />} 
                label="Bestiário" 
              />

               <NavButton 
                active={view === 'resources'} 
                onClick={() => setView('resources')} 
                icon={<Map className="w-4 h-4" />} 
                label="Links" 
              />
              
               <NavButton 
                active={view === 'history'} 
                onClick={() => setView('history')} 
                icon={<History className="w-4 h-4" />} 
                label="Arquivos" 
              />
              
              <div className="h-6 w-px bg-slate-700 mx-2"></div>
              <button
                onClick={() => handleSelectCampaign(null)}
                className="flex items-center gap-2 px-3 py-2 text-slate-400 hover:text-amber-400 transition-colors text-sm font-medium"
                title="Trocar de campanha"
              >
                  <Repeat className="w-4 h-4" />
                  <span className="hidden xl:inline">Campanhas</span>
              </button>
              <button 
                onClick={handleLogout}
                className="flex items-center gap-2 px-3 py-2 text-slate-400 hover:text-red-400 transition-colors text-sm font-medium"
                title="Sair"
              >
                  <LogOut className="w-4 h-4" />
                  <span className="hidden xl:inline">Sair</span>
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Suspense fallback={<div className="py-20 text-center text-slate-500">Carregando...</div>}>
          {renderContent()}
        </Suspense>
      </main>

    </div>
  );
};

// Sub-component for nav buttons
const NavButton: React.FC<{ active: boolean; onClick: () => void; icon: React.ReactNode; label: string }> = ({ active, onClick, icon, label }) => (
    <button
        onClick={onClick}
        title={label}
        className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
            active 
            ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' 
            : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800'
        }`}
    >
        {icon}
        <span className="hidden xl:inline">{label}</span>
    </button>
);

export default App;