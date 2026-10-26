import React, { useEffect, useState } from 'react';
import { Crown, Shield, Plus, KeyRound, Loader2, LogOut, Scroll } from 'lucide-react';
import { CampaignConfig, CampaignSummary } from '../types';
import { createCampaign, joinCampaign, listMyCampaigns } from '../services/campaignService';

interface CampaignPickerProps {
  userId: string;
  username: string;
  onOpen: (campaignId: string) => void;
  onLogout: () => void;
}

// Dados da versão antiga do app, que ficavam só neste navegador
const readLegacyConfig = (): CampaignConfig | null => {
  try {
    const saved = localStorage.getItem('rpg_config');
    if (!saved) return null;
    const config = JSON.parse(saved) as CampaignConfig;
    const hasContent = config.fields?.length || config.npcs?.length || config.links?.length || config.currencies?.length;
    return hasContent ? config : null;
  } catch {
    return null;
  }
};

const CampaignPicker: React.FC<CampaignPickerProps> = ({ userId, username, onOpen, onLogout }) => {
  const [campaigns, setCampaigns] = useState<CampaignSummary[] | null>(null);
  const [title, setTitle] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState<'create' | 'join' | null>(null);
  const [error, setError] = useState('');
  const [legacyConfig] = useState(readLegacyConfig);
  const [importLegacy, setImportLegacy] = useState(true);

  useEffect(() => {
    listMyCampaigns(userId)
      .then(setCampaigns)
      .catch(e => { setError(e.message); setCampaigns([]); });
  }, [userId]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy('create');
    try {
      const useLegacy = legacyConfig && importLegacy;
      const id = await createCampaign(
        title || (useLegacy ? legacyConfig.title : ''),
        useLegacy ? legacyConfig : undefined
      );
      onOpen(id);
    } catch (e: any) {
      setError(`Não foi possível criar a campanha: ${e.message}`);
    } finally {
      setBusy(null);
    }
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    setError('');
    setBusy('join');
    try {
      onOpen(await joinCampaign(code));
    } catch (e: any) {
      setError(/inválido/i.test(e.message) ? 'Código de convite inválido.' : e.message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black text-slate-200 p-4">
      <div className="max-w-3xl mx-auto py-10 space-y-8 animate-fade-in">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-amber-600 p-2 rounded-lg"><Scroll className="h-6 w-6 text-white" /></div>
            <div>
              <h1 className="text-2xl font-bold cinzel text-amber-500">Suas Campanhas</h1>
              <p className="text-sm text-slate-500">Olá, {username}.</p>
            </div>
          </div>
          <button onClick={onLogout} className="flex items-center gap-2 px-3 py-2 text-slate-400 hover:text-red-400 transition-colors text-sm">
            <LogOut className="w-4 h-4" /> Sair
          </button>
        </div>

        {error && <p className="text-red-500 text-sm text-center bg-red-950/20 p-2 rounded border border-red-900/50">{error}</p>}

        {campaigns === null ? (
          <div className="flex justify-center py-10"><Loader2 className="w-8 h-8 animate-spin text-amber-500" /></div>
        ) : campaigns.length === 0 ? (
          <p className="text-center text-slate-500 py-6 bg-slate-900/50 rounded-xl border border-slate-800">
            Você ainda não participa de nenhuma campanha. Crie uma como Mestre ou entre com o código que o Mestre te passou.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {campaigns.map(c => (
              <button
                key={c.id}
                onClick={() => onOpen(c.id)}
                className="text-left bg-slate-900 border border-slate-800 p-5 rounded-xl hover:border-amber-500/50 transition-all"
              >
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-lg font-bold cinzel text-slate-100">{c.title}</h3>
                  <span className={`flex items-center gap-1 text-xs uppercase tracking-widest px-2 py-0.5 rounded border ${c.role === 'GM' ? 'border-purple-700 text-purple-400' : 'border-emerald-700 text-emerald-400'}`}>
                    {c.role === 'GM' ? <Crown className="w-3 h-3" /> : <Shield className="w-3 h-3" />}
                    {c.role === 'GM' ? 'Mestre' : 'Jogador'}
                  </span>
                </div>
                <p className="text-sm text-slate-500 line-clamp-2">{c.description}</p>
              </button>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <form onSubmit={handleCreate} className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
            <h3 className="font-bold text-slate-200 flex items-center gap-2"><Crown className="w-4 h-4 text-purple-400" /> Criar campanha (Mestre)</h3>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Nome da campanha"
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-slate-100 focus:ring-2 focus:ring-amber-500 focus:outline-none"
            />
            {legacyConfig && (
              <label className="flex items-start gap-2 text-xs text-slate-400">
                <input type="checkbox" checked={importLegacy} onChange={e => setImportLegacy(e.target.checked)} className="mt-0.5" />
                Importar campos, NPCs, links e moedas de "{legacyConfig.title}" salvos neste navegador
              </label>
            )}
            <button disabled={busy !== null} className="w-full bg-purple-700 hover:bg-purple-600 disabled:opacity-60 text-white font-bold py-2 rounded-lg flex items-center justify-center gap-2">
              {busy === 'create' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Criar
            </button>
          </form>

          <form onSubmit={handleJoin} className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
            <h3 className="font-bold text-slate-200 flex items-center gap-2"><Shield className="w-4 h-4 text-emerald-400" /> Entrar como jogador</h3>
            <input
              value={code}
              onChange={e => setCode(e.target.value.toUpperCase())}
              placeholder="Código de convite"
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-slate-100 font-mono tracking-widest focus:ring-2 focus:ring-amber-500 focus:outline-none"
            />
            <button disabled={busy !== null} className="w-full bg-emerald-700 hover:bg-emerald-600 disabled:opacity-60 text-white font-bold py-2 rounded-lg flex items-center justify-center gap-2">
              {busy === 'join' ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />} Entrar
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default CampaignPicker;
