import React, { useEffect, useState } from 'react';
import { Crown, Shield, Plus, KeyRound, LogOut, Loader2, Upload } from 'lucide-react';
import { CampaignSummary } from '../types';
import { createCampaign, joinCampaign, listMyCampaigns, readLegacyConfig, saveConfig } from '../services/campaignRepo';

interface CampaignPickerProps {
  userId: string;
  username: string;
  onSelect: (campaignId: string) => void;
  onLogout: () => void;
}

const CampaignPicker: React.FC<CampaignPickerProps> = ({ userId, username, onSelect, onLogout }) => {
  const [campaigns, setCampaigns] = useState<CampaignSummary[] | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const legacyConfig = readLegacyConfig();

  useEffect(() => {
    listMyCampaigns(userId)
      .then(setCampaigns)
      .catch(err => { setError((err as Error).message); setCampaigns([]); });
  }, [userId]);

  const run = async (action: () => Promise<string>) => {
    setError('');
    setBusy(true);
    try {
      onSelect(await action());
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  const handleCreate = () => {
    if (!newTitle.trim()) return;
    run(() => createCampaign(newTitle.trim()));
  };

  const handleJoin = () => {
    if (!inviteCode.trim()) return;
    run(() => joinCampaign(inviteCode.trim()));
  };

  // Leva a campanha salva neste navegador pela versão antiga (sem backend) para o banco
  const handleImport = () => {
    if (!legacyConfig) return;
    run(async () => {
      const id = await createCampaign(legacyConfig.title || 'Campanha importada');
      await saveConfig(id, { title: '', description: '', fields: [], npcs: [], links: [], currencies: [] }, {
        ...legacyConfig,
        npcs: legacyConfig.npcs || [],
        links: legacyConfig.links || [],
        currencies: legacyConfig.currencies || [],
      });
      try { localStorage.setItem('rpg_config_imported', id); } catch { /* sem armazenamento local */ }
      return id;
    });
  };

  const alreadyImported = (() => {
    try { return Boolean(localStorage.getItem('rpg_config_imported')); } catch { return true; }
  })();

  const inputClass = "flex-1 bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-slate-100 focus:ring-2 focus:ring-amber-500 focus:outline-none";
  const buttonClass = "bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2";

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black text-slate-200 p-4">
      <div className="max-w-2xl mx-auto py-10 space-y-8 animate-fade-in">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold cinzel text-amber-500">Suas Campanhas</h1>
            <p className="text-slate-400 mt-1">Bem-vindo, {username}.</p>
          </div>
          <button onClick={onLogout} className="flex items-center gap-2 px-3 py-2 text-slate-400 hover:text-red-400 transition-colors text-sm">
            <LogOut className="w-4 h-4" /> Sair
          </button>
        </div>

        {error && <p className="text-red-500 text-sm bg-red-950/20 p-3 rounded border border-red-900/50">{error}</p>}

        <div className="space-y-3">
          {campaigns === null && <Loader2 className="w-6 h-6 animate-spin text-slate-500" />}
          {campaigns?.length === 0 && (
            <p className="text-slate-500 bg-slate-900/50 border border-slate-800 rounded-xl p-6 text-center">
              Você ainda não participa de nenhuma campanha. Crie uma como Mestre ou entre com o código que o Mestre te passou.
            </p>
          )}
          {campaigns?.map(c => (
            <button
              key={c.id}
              disabled={busy}
              onClick={() => onSelect(c.id)}
              className="w-full bg-slate-900 border border-slate-800 hover:border-amber-500/50 rounded-xl p-5 flex items-center justify-between text-left transition-colors"
            >
              <span className="text-xl font-bold cinzel text-slate-100">{c.title}</span>
              <span className={`flex items-center gap-2 text-xs uppercase tracking-widest ${c.role === 'GM' ? 'text-purple-400' : 'text-emerald-400'}`}>
                {c.role === 'GM' ? <Crown className="w-4 h-4" /> : <Shield className="w-4 h-4" />}
                {c.role === 'GM' ? 'Mestre' : 'Jogador'}
              </span>
            </button>
          ))}
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-3">
          <h2 className="text-lg font-bold text-slate-200 flex items-center gap-2"><Crown className="w-5 h-5 text-purple-400" /> Criar campanha (você será o Mestre)</h2>
          <div className="flex flex-col sm:flex-row gap-2">
            <input className={inputClass} value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="ex: A Maldição de Strahd" />
            <button className={buttonClass} disabled={busy} onClick={handleCreate}><Plus className="w-4 h-4" /> Criar</button>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-3">
          <h2 className="text-lg font-bold text-slate-200 flex items-center gap-2"><KeyRound className="w-5 h-5 text-emerald-400" /> Entrar como jogador</h2>
          <div className="flex flex-col sm:flex-row gap-2">
            <input className={`${inputClass} uppercase font-mono`} value={inviteCode} onChange={e => setInviteCode(e.target.value)} placeholder="Código de convite" maxLength={8} />
            <button className={buttonClass} disabled={busy} onClick={handleJoin}><KeyRound className="w-4 h-4" /> Entrar</button>
          </div>
        </div>

        {legacyConfig && !alreadyImported && (
          <div className="bg-slate-900/50 border border-dashed border-slate-700 rounded-xl p-6 space-y-3">
            <p className="text-slate-400 text-sm">
              Encontramos a campanha <strong className="text-slate-200">{legacyConfig.title}</strong> salva neste navegador pela versão antiga do app.
              Importe para o banco para compartilhar com os jogadores (campos, NPCs, links e moedas; os registros de sessão antigos ficam só neste navegador).
            </p>
            <button className={buttonClass} disabled={busy} onClick={handleImport}><Upload className="w-4 h-4" /> Importar como Mestre</button>
          </div>
        )}
      </div>
    </div>
  );
};

export default CampaignPicker;
