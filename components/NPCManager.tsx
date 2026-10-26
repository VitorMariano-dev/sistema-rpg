import React, { useState } from 'react';
import { Plus, Trash2, Skull, Heart, HelpCircle, User, Eye, Wand2, Loader2, Lock } from 'lucide-react';
import { CampaignConfig, NPC, NPCCategory, SessionLog, ResourceValue } from '../types';
import { generateNPCDescriptions } from '../services/geminiService';
import { getKnownPlayers } from '../utils';

interface NPCManagerProps {
  config: CampaignConfig;
  onUpdateConfig: (newConfig: CampaignConfig) => void;
  logs: SessionLog[];
  players?: string[]; // Membros da campanha (jogadores)
}

const NPCManager: React.FC<NPCManagerProps> = ({ config, onUpdateConfig, logs, players = [] }) => {
  // Form State
  const [name, setName] = useState('');
  const [description, setDescription] = useState(''); // GM Description
  const [publicDescription, setPublicDescription] = useState(''); // Player Description
  const [category, setCategory] = useState<NPCCategory>('HOSTILE');
  const [hpMax, setHpMax] = useState('10');
  const [mpMax, setMpMax] = useState('0');
  
  const [isGenerating, setIsGenerating] = useState(false);

  // Derive unique players list for visibility toggling
  const availablePlayers = getKnownPlayers(logs, players);

  // Helper for Required Asterisk
  const Req = () => <span className="text-red-500 ml-1">*</span>;

  const handleAddNPC = () => {
    if (!name.trim()) return;

    const maxHpVal = parseInt(hpMax) || 10;
    const maxMpVal = parseInt(mpMax) || 0;

    const newNPC: NPC = {
      id: crypto.randomUUID(),
      name,
      description,
      publicDescription: publicDescription || description, // Fallback if empty
      category,
      stats: {
          hp: { current: maxHpVal, max: maxHpVal },
          mp: { current: maxMpVal, max: maxMpVal }
      },
      discoveredBy: [] 
    };

    const currentNPCs = config.npcs || [];

    onUpdateConfig({
      ...config,
      npcs: [...currentNPCs, newNPC]
    });

    // Reset Form
    setName('');
    setDescription('');
    setPublicDescription('');
    setCategory('HOSTILE');
    setHpMax('10');
    setMpMax('0');
  };

  const handleDeleteNPC = (id: string) => {
    onUpdateConfig({
        ...config,
        npcs: (config.npcs || []).filter(n => n.id !== id)
    });
  };

  const handleUpdateNPC = (id: string, updates: Partial<NPC>) => {
      onUpdateConfig({
          ...config,
          npcs: config.npcs.map(n => n.id === id ? { ...n, ...updates } : n)
      });
  };

  const handleStatChange = (npcId: string, type: 'hp' | 'mp', field: 'current' | 'max', value: string) => {
      const numValue = parseInt(value) || 0;
      const npc = config.npcs.find(n => n.id === npcId);
      if(!npc) return;

      const newStats = { ...npc.stats };
      let newCurrent = newStats[type].current;
      let newMax = newStats[type].max;

      if (field === 'max') {
          newMax = numValue;
          if (newCurrent > newMax) newCurrent = newMax;
      } else {
          newCurrent = numValue;
          if (newCurrent > newMax) newCurrent = newMax;
      }

      newStats[type] = { current: newCurrent, max: newMax };
      handleUpdateNPC(npcId, { stats: newStats });
  };

  const toggleVisibility = (npcId: string, player: string) => {
      const npc = config.npcs.find(n => n.id === npcId);
      if(!npc) return;

      const currentList = npc.discoveredBy || [];
      const newList = currentList.includes(player) 
        ? currentList.filter(p => p !== player)
        : [...currentList, player];
      
      handleUpdateNPC(npcId, { discoveredBy: newList });
  };

  const handleGenerateAI = async () => {
      if (!name.trim()) return;
      setIsGenerating(true);
      try {
          const result = await generateNPCDescriptions(name, description || "Fantasia medieval padrão");
          setDescription(result.gmDescription);
          setPublicDescription(result.publicDescription);
      } catch (error) {
          alert((error as Error).message);
      } finally {
          setIsGenerating(false);
      }
  };

  const getCategoryStyles = (cat: NPCCategory) => {
      switch(cat) {
          case 'FRIENDLY': return { bg: 'bg-emerald-950/30', border: 'border-emerald-500/50', icon: <Heart className="text-emerald-500 w-5 h-5" />, label: 'Amigável' };
          case 'HOSTILE': return { bg: 'bg-red-950/30', border: 'border-red-500/50', icon: <Skull className="text-red-500 w-5 h-5" />, label: 'Hostil' };
          case 'DECEPTIVE': return { bg: 'bg-purple-950/30', border: 'border-purple-500/50', icon: <HelpCircle className="text-purple-500 w-5 h-5" />, label: 'Falso/Incerto' };
      }
  };

  const renderResourceBar = (label: string, value: ResourceValue, colorClass: string, onChange: (field: 'current' | 'max', val: string) => void) => {
      const percentage = value.max > 0 ? (value.current / value.max) * 100 : 0;
      return (
          <div className="mb-2">
              <div className="flex justify-between items-end text-xs mb-1">
                  <span className="font-bold text-slate-300">{label}</span>
                  <div className="flex items-center gap-1">
                      <input 
                        type="number" 
                        value={value.current} 
                        onChange={(e) => onChange('current', e.target.value)}
                        className="w-12 bg-slate-900 border border-slate-700 rounded px-1 text-right focus:border-amber-500 outline-none" 
                      />
                      <span className="text-slate-500">/</span>
                      <input 
                        type="number" 
                        value={value.max} 
                        onChange={(e) => onChange('max', e.target.value)}
                        className="w-12 bg-slate-900 border border-slate-700 rounded px-1 text-right focus:border-amber-500 outline-none" 
                      />
                  </div>
              </div>
              <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div className={`h-full ${colorClass}`} style={{width: `${Math.min(100, Math.max(0, percentage))}%`}}></div>
              </div>
          </div>
      )
  };

  return (
    <div className="space-y-8 animate-fade-in pb-20">
       <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl">
            <h2 className="text-2xl font-bold text-amber-500 mb-2 cinzel flex items-center gap-2">
                <User className="w-6 h-6" /> Bestiário & NPCs
            </h2>
            <p className="text-slate-400 mb-6">Cadastre aliados, monstros e defina quem já os encontrou. Campos marcados com <Req/> são obrigatórios.</p>

            {/* Creation Form */}
            <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 mb-8">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
                    
                    {/* Basic Info */}
                    <div className="md:col-span-3 space-y-4">
                        <div>
                            <label className="block text-xs uppercase tracking-wider text-slate-500 mb-1">Nome <Req/></label>
                            <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 focus:border-amber-500 outline-none" placeholder="Ex: Lorde das Sombras" />
                        </div>
                        <div>
                            <label className="block text-xs uppercase tracking-wider text-slate-500 mb-1">Categoria <Req/></label>
                            <select value={category} onChange={(e) => setCategory(e.target.value as NPCCategory)} className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 focus:border-amber-500 outline-none">
                                <option value="HOSTILE">Hostil</option>
                                <option value="FRIENDLY">Amigável</option>
                                <option value="DECEPTIVE">Falso</option>
                            </select>
                        </div>
                         <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="block text-[10px] uppercase tracking-wider text-slate-500 mb-1">HP Max</label>
                                <input type="number" value={hpMax} onChange={(e) => setHpMax(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-2 text-center" />
                            </div>
                            <div>
                                <label className="block text-[10px] uppercase tracking-wider text-slate-500 mb-1">MP Max</label>
                                <input type="number" value={mpMax} onChange={(e) => setMpMax(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-2 text-center" />
                            </div>
                        </div>
                    </div>

                    {/* Descriptions */}
                    <div className="md:col-span-9 space-y-4">
                        <div className="flex gap-4">
                            <div className="flex-1">
                                <label className="block text-xs uppercase tracking-wider text-amber-500 mb-1 flex items-center gap-1"><Eye className="w-3 h-3"/> Descrição Pública (Jogadores)</label>
                                <textarea value={publicDescription} onChange={(e) => setPublicDescription(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 focus:border-amber-500 outline-none text-sm h-24" placeholder="O que os jogadores veem..." />
                            </div>
                            <div className="flex-1">
                                <label className="block text-xs uppercase tracking-wider text-purple-500 mb-1 flex items-center gap-1"><Lock className="w-3 h-3"/> Descrição Verdadeira (Mestre)</label>
                                <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 focus:border-purple-500 outline-none text-sm h-24" placeholder="Segredos, táticas e verdade..." />
                            </div>
                        </div>
                        <div className="flex justify-between items-center">
                             <button 
                                onClick={handleGenerateAI}
                                disabled={isGenerating || !name}
                                className="text-indigo-400 hover:text-indigo-300 text-xs flex items-center gap-2 border border-indigo-900/50 bg-indigo-950/30 px-3 py-2 rounded transition-colors disabled:opacity-50"
                            >
                                {isGenerating ? <Loader2 className="w-3 h-3 animate-spin"/> : <Wand2 className="w-3 h-3"/>}
                                Gerar Descrições com IA
                             </button>

                             <button onClick={handleAddNPC} className="bg-amber-600 hover:bg-amber-500 text-white px-6 py-2 rounded flex items-center gap-2 font-bold shadow-lg shadow-amber-900/20">
                                <Plus className="w-4 h-4" /> Adicionar NPC
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* List */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {(config.npcs || []).map(npc => {
                    const style = getCategoryStyles(npc.category);
                    return (
                        <div key={npc.id} className={`${style.bg} border ${style.border} rounded-lg p-4 relative group flex flex-col h-full`}>
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                    {style.icon}
                                    <span className={`text-xs font-bold uppercase tracking-wider ${npc.category === 'HOSTILE' ? 'text-red-400' : npc.category === 'FRIENDLY' ? 'text-emerald-400' : 'text-purple-400'}`}>
                                        {style.label}
                                    </span>
                                </div>
                                <button onClick={() => handleDeleteNPC(npc.id)} className="text-slate-600 hover:text-red-500 transition-colors">
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>

                            <h3 className="text-xl font-bold text-slate-200 cinzel mb-1">{npc.name}</h3>
                            
                            {/* Descriptions */}
                            <div className="space-y-2 mb-4">
                                <div className="text-xs bg-slate-950/50 p-2 rounded border border-slate-800/50">
                                    <strong className="text-amber-500 block mb-0.5 flex items-center gap-1"><Eye className="w-3 h-3"/> Pública:</strong>
                                    <p className="text-slate-400 leading-tight">{npc.publicDescription}</p>
                                </div>
                                <div className="text-xs bg-purple-950/20 p-2 rounded border border-purple-900/30">
                                    <strong className="text-purple-400 block mb-0.5 flex items-center gap-1"><Lock className="w-3 h-3"/> Mestre:</strong>
                                    <p className="text-slate-400 leading-tight">{npc.description}</p>
                                </div>
                            </div>

                            {/* Combat Stats */}
                            <div className="bg-slate-950/50 p-3 rounded border border-slate-800 mb-4">
                                {renderResourceBar("Vida", npc.stats?.hp || {current:0, max:0}, "bg-red-500", (f, v) => handleStatChange(npc.id, 'hp', f, v))}
                                {renderResourceBar("Mana", npc.stats?.mp || {current:0, max:0}, "bg-blue-500", (f, v) => handleStatChange(npc.id, 'mp', f, v))}
                            </div>

                            {/* Visibility Control */}
                            <div className="mt-auto pt-3 border-t border-slate-800/50">
                                <div className="flex items-center gap-2 mb-2">
                                    <Eye className="w-4 h-4 text-slate-500" />
                                    <span className="text-xs uppercase font-bold text-slate-500">Visível para:</span>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {availablePlayers.length === 0 && <span className="text-xs text-slate-600 italic">Sem jogadores registrados.</span>}
                                    {availablePlayers.map(player => {
                                        const isVisible = (npc.discoveredBy || []).includes(player);
                                        return (
                                            <button 
                                                key={player}
                                                onClick={() => toggleVisibility(npc.id, player)}
                                                className={`text-xs px-2 py-1 rounded border transition-colors ${
                                                    isVisible 
                                                    ? 'bg-amber-900/30 border-amber-600/50 text-amber-200' 
                                                    : 'bg-slate-900 border-slate-700 text-slate-500 hover:border-slate-500'
                                                }`}
                                            >
                                                {player}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    )
                })}
            </div>
       </div>
    </div>
  );
};

export default NPCManager;