import React, { useState } from 'react';
import { Plus, Trash2, Wand2, Loader2, Link as LinkIcon, Coins, FormInput, Map, FileText, MessageCircle, Globe, Lock, Eye, EyeOff } from 'lucide-react';
import { CampaignConfig, CustomField, FieldType, ExternalLink, CurrencyType, SessionLog } from '../types';
import { suggestCampaignFields, generateDocumentContent } from '../services/geminiService';
import { getKnownPlayers } from '../utils';

interface FieldBuilderProps {
  config: CampaignConfig;
  onUpdateConfig: (newConfig: CampaignConfig) => void;
  logs?: SessionLog[]; // Necessário para listar jogadores para permissões
  players?: string[]; // Membros da campanha (jogadores)
}

type Tab = 'FIELDS' | 'LINKS' | 'CURRENCY';

const FieldBuilder: React.FC<FieldBuilderProps> = ({ config, onUpdateConfig, logs = [], players = [] }) => {
  const [activeTab, setActiveTab] = useState<Tab>('FIELDS');
  const [isGenerating, setIsGenerating] = useState(false);
  const [promptTheme, setPromptTheme] = useState('');
  
  // Players list
  const availablePlayers = getKnownPlayers(logs, players);

  // Field Form State
  const [newFieldLabel, setNewFieldLabel] = useState('');
  const [newFieldType, setNewFieldType] = useState<FieldType>(FieldType.TEXT);

  // Link/Resource Form State
  const [resourceTitle, setResourceTitle] = useState('');
  const [resourceCategory, setResourceCategory] = useState<ExternalLink['category']>('MAP');
  const [resourceType, setResourceType] = useState<ExternalLink['type']>('EXTERNAL');
  const [resourceUrl, setResourceUrl] = useState('');
  const [resourceContent, setResourceContent] = useState('');
  const [resourceIsPublic, setResourceIsPublic] = useState(true);
  const [docKeywords, setDocKeywords] = useState(''); // For AI generation
  const [isGeneratingDoc, setIsGeneratingDoc] = useState(false);

  // Currency Form State
  const [currencyName, setCurrencyName] = useState('');
  const [currencyWeight, setCurrencyWeight] = useState('');

  // Helper for Required Asterisk
  const Req = () => <span className="text-red-500 ml-1">*</span>;

  // --- FIELDS HANDLERS ---
  const handleAddField = () => {
    if (!newFieldLabel.trim()) return;
    const newField: CustomField = {
      id: crypto.randomUUID(),
      label: newFieldLabel,
      type: newFieldType,
      description: '',
      placeholder: ''
    };
    onUpdateConfig({ ...config, fields: [...config.fields, newField] });
    setNewFieldLabel('');
    setNewFieldType(FieldType.TEXT);
  };

  const handleDeleteField = (id: string) => {
    onUpdateConfig({ ...config, fields: config.fields.filter(f => f.id !== id) });
  };

  const handleGenerateAI = async () => {
    if (!promptTheme.trim()) return;
    setIsGenerating(true);
    try {
      const suggestedFields = await suggestCampaignFields(promptTheme);
      if (suggestedFields.length > 0) {
        onUpdateConfig({ ...config, fields: [...config.fields, ...suggestedFields] });
      }
    } catch (error) {
      alert((error as Error).message);
    } finally {
      setIsGenerating(false);
    }
  };

  // --- RESOURCE HANDLERS ---
  const handleAddResource = () => {
      if (!resourceTitle.trim()) return;
      if (resourceType === 'EXTERNAL' && !resourceUrl.trim()) return;
      
      const newResource: ExternalLink = {
          id: crypto.randomUUID(),
          title: resourceTitle,
          category: resourceCategory,
          type: resourceType,
          url: resourceType === 'EXTERNAL' ? resourceUrl : undefined,
          content: resourceType === 'INTERNAL' ? resourceContent : undefined,
          isPublic: resourceIsPublic,
          visibleTo: [] // Inicialmente vazio, GM configura depois na lista
      };

      const currentLinks = config.links || [];
      onUpdateConfig({ ...config, links: [...currentLinks, newResource] });
      
      // Reset
      setResourceTitle('');
      setResourceUrl('');
      setResourceContent('');
      setDocKeywords('');
      setResourceIsPublic(true);
  };

  const handleDeleteResource = (id: string) => {
      onUpdateConfig({ ...config, links: (config.links || []).filter(l => l.id !== id) });
  };

  const toggleResourceVisibility = (resourceId: string, player: string) => {
      const links = config.links || [];
      const updatedLinks = links.map(l => {
          if (l.id !== resourceId) return l;
          
          const currentList = l.visibleTo || [];
          const newList = currentList.includes(player) 
            ? currentList.filter(p => p !== player)
            : [...currentList, player];
          
          return { ...l, visibleTo: newList, isPublic: false }; 
      });
      onUpdateConfig({ ...config, links: updatedLinks });
  };

  const toggleResourcePublic = (resourceId: string) => {
      const links = config.links || [];
      const updatedLinks = links.map(l => {
          if (l.id !== resourceId) return l;
          return { ...l, isPublic: !l.isPublic };
      });
      onUpdateConfig({ ...config, links: updatedLinks });
  };

  const handleGenerateDocAI = async () => {
      if (!docKeywords.trim()) return;
      setIsGeneratingDoc(true);
      try {
          const text = await generateDocumentContent(docKeywords, resourceCategory);
          setResourceContent(text);
      } catch (error) {
          alert((error as Error).message);
      } finally {
          setIsGeneratingDoc(false);
      }
  };

  // --- CURRENCY HANDLERS ---
  const handleAddCurrency = () => {
      if (!currencyName.trim()) return;
      const newCurrency: CurrencyType = {
          id: crypto.randomUUID(),
          name: currencyName,
          weightPerUnit: parseFloat(currencyWeight) || 0
      };
      const currentCurrencies = config.currencies || [];
      onUpdateConfig({ ...config, currencies: [...currentCurrencies, newCurrency] });
      setCurrencyName('');
      setCurrencyWeight('');
  };

  const handleDeleteCurrency = (id: string) => {
      onUpdateConfig({ ...config, currencies: (config.currencies || []).filter(c => c.id !== id) });
  };

  return (
    <div className="space-y-8 animate-fade-in pb-20">
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl">
        <h2 className="text-2xl font-bold text-amber-500 mb-2 cinzel">Configuração do Mestre</h2>
        <p className="text-slate-400 mb-6">Gerencie regras, campos, links e economia. Campos marcados com <Req/> são obrigatórios.</p>

        {/* Campaign Meta */}
        <div className="grid grid-cols-1 gap-4 mb-8">
            <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Título da Campanha</label>
                <input
                    type="text"
                    value={config.title}
                    onChange={(e) => onUpdateConfig({...config, title: e.target.value})}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-slate-100 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    placeholder="ex: A Maldição de Strahd"
                />
            </div>
            <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Descrição da Campanha</label>
                <textarea
                    value={config.description}
                    onChange={(e) => onUpdateConfig({...config, description: e.target.value})}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-slate-100 focus:ring-2 focus:ring-amber-500 focus:outline-none min-h-[80px]"
                    placeholder="ex: Os heróis chegam à vila de Barovia envoltos em névoa..."
                />
            </div>
        </div>

        {/* TABS */}
        <div className="flex border-b border-slate-800 mb-6 overflow-x-auto">
            <button 
                onClick={() => setActiveTab('FIELDS')}
                className={`px-4 py-2 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${activeTab === 'FIELDS' ? 'border-amber-500 text-amber-500' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
            >
                <FormInput className="w-4 h-4" /> Campos
            </button>
            <button 
                onClick={() => setActiveTab('LINKS')}
                className={`px-4 py-2 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${activeTab === 'LINKS' ? 'border-amber-500 text-amber-500' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
            >
                <LinkIcon className="w-4 h-4" /> Recursos & Docs
            </button>
            <button 
                onClick={() => setActiveTab('CURRENCY')}
                className={`px-4 py-2 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${activeTab === 'CURRENCY' ? 'border-amber-500 text-amber-500' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
            >
                <Coins className="w-4 h-4" /> Economia
            </button>
        </div>

        {/* --- FIELDS TAB --- */}
        {activeTab === 'FIELDS' && (
            <div className="animate-fade-in">
                {/* AI Generator */}
                <div className="mb-8 bg-indigo-950/30 border border-indigo-900/50 p-4 rounded-lg">
                    <h3 className="text-indigo-400 font-bold mb-2 flex items-center gap-2">
                        <Wand2 className="w-4 h-4" /> Gerador de Campos com IA
                    </h3>
                    <div className="flex gap-2">
                        <input 
                            type="text"
                            value={promptTheme}
                            onChange={(e) => setPromptTheme(e.target.value)}
                            placeholder="Ex: Mistério de detetive cyberpunk noir..."
                            className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-indigo-500"
                        />
                        <button 
                            onClick={handleGenerateAI}
                            disabled={isGenerating || !promptTheme}
                            className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2"
                        >
                            {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Gerar'}
                        </button>
                    </div>
                </div>

                {/* Manual Add */}
                <div className="flex flex-col md:flex-row gap-4 items-end mb-6 pb-6 border-b border-slate-800">
                    <div className="flex-1 w-full">
                        <label className="block text-xs uppercase tracking-wider text-slate-500 mb-1">Nome do Campo <Req/></label>
                        <input 
                            type="text" 
                            value={newFieldLabel}
                            onChange={(e) => setNewFieldLabel(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-slate-200 focus:border-amber-500 outline-none"
                        />
                    </div>
                    <div className="w-full md:w-48">
                        <label className="block text-xs uppercase tracking-wider text-slate-500 mb-1">Tipo <Req/></label>
                        <select 
                            value={newFieldType}
                            onChange={(e) => setNewFieldType(e.target.value as FieldType)}
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-slate-200 focus:border-amber-500 outline-none appearance-none"
                        >
                            <option value={FieldType.TEXT}>Texto Curto</option>
                            <option value={FieldType.TEXTAREA}>Descrição Longa</option>
                            <option value={FieldType.NUMBER}>Número Simples</option>
                            <option value={FieldType.RESOURCE}>Barra de Recurso</option>
                            <option value={FieldType.CHECKBOX}>Caixa de Seleção</option>
                        </select>
                    </div>
                    <button onClick={handleAddField} className="bg-amber-600 hover:bg-amber-500 text-white px-6 py-2 rounded-lg font-bold flex items-center gap-2">
                        <Plus className="w-4 h-4" /> Adicionar
                    </button>
                </div>

                <div className="space-y-3">
                    {config.fields.map((field) => (
                        <div key={field.id} className="flex items-center justify-between bg-slate-950 p-4 rounded-lg border border-slate-800">
                            <div>
                                <p className="font-bold text-slate-200">{field.label}</p>
                                <p className="text-xs text-slate-500">{field.type}</p>
                            </div>
                            <button onClick={() => handleDeleteField(field.id)} className="text-slate-600 hover:text-red-500 p-2">
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        )}

        {/* --- LINKS/RESOURCES TAB --- */}
        {activeTab === 'LINKS' && (
            <div className="animate-fade-in">
                <p className="text-sm text-slate-500 mb-4">Adicione links públicos, mapas ou crie documentos secretos para jogadores específicos.</p>
                
                <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 mb-8 space-y-4">
                    {/* Header Inputs */}
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-start">
                        <div className="md:col-span-4">
                            <label className="text-[10px] uppercase text-slate-500 block mb-1">Título <Req/></label>
                            <input type="text" value={resourceTitle} onChange={e => setResourceTitle(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-sm" placeholder="Ex: Carta do Rei" />
                        </div>
                        <div className="md:col-span-3">
                            <label className="text-[10px] uppercase text-slate-500 block mb-1">Categoria <Req/></label>
                            <select value={resourceCategory} onChange={e => setResourceCategory(e.target.value as any)} className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-sm">
                                <option value="MAP">Mapa</option>
                                <option value="DOC">Documento</option>
                                <option value="DISCORD">Discord</option>
                                <option value="OTHER">Outro</option>
                            </select>
                        </div>
                        <div className="md:col-span-3">
                             <label className="text-[10px] uppercase text-slate-500 block mb-1">Tipo de Recurso</label>
                             <div className="flex bg-slate-900 rounded p-1 border border-slate-700">
                                 <button 
                                    onClick={() => setResourceType('EXTERNAL')}
                                    className={`flex-1 text-xs py-1 rounded transition-colors ${resourceType === 'EXTERNAL' ? 'bg-slate-700 text-white' : 'text-slate-500'}`}
                                >Link Externo</button>
                                 <button 
                                    onClick={() => setResourceType('INTERNAL')}
                                    className={`flex-1 text-xs py-1 rounded transition-colors ${resourceType === 'INTERNAL' ? 'bg-slate-700 text-white' : 'text-slate-500'}`}
                                >Texto Interno</button>
                             </div>
                        </div>
                        <div className="md:col-span-2">
                            <label className="text-[10px] uppercase text-slate-500 block mb-1">Visibilidade</label>
                             <div className="flex items-center gap-2 h-[38px]">
                                <input type="checkbox" checked={resourceIsPublic} onChange={e => setResourceIsPublic(e.target.checked)} className="w-4 h-4 rounded border-slate-600 bg-slate-900 text-amber-600" />
                                <span className="text-xs text-slate-400">Público</span>
                             </div>
                        </div>
                    </div>

                    {/* Dynamic Inputs based on Type */}
                    {resourceType === 'EXTERNAL' ? (
                        <div className="animate-fade-in">
                            <label className="text-[10px] uppercase text-slate-500 block mb-1">URL (Link) <Req/></label>
                            <div className="flex gap-2">
                                <Globe className="w-5 h-5 text-slate-500 mt-2" />
                                <input type="text" value={resourceUrl} onChange={e => setResourceUrl(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-sm" placeholder="https://..." />
                            </div>
                        </div>
                    ) : (
                        <div className="animate-fade-in space-y-3">
                             <div className="flex gap-2 items-end bg-indigo-950/20 p-3 rounded border border-indigo-900/30">
                                <div className="flex-1">
                                    <label className="text-[10px] uppercase text-indigo-400 block mb-1 flex items-center gap-1"><Wand2 className="w-3 h-3"/> IA: Palavras-chaves para gerar conteúdo</label>
                                    <input 
                                        type="text" 
                                        value={docKeywords} 
                                        onChange={e => setDocKeywords(e.target.value)} 
                                        className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-sm focus:border-indigo-500" 
                                        placeholder="Ex: carta antiga, aviso de perigo, escrita por um goblin..." 
                                    />
                                </div>
                                <button 
                                    onClick={handleGenerateDocAI}
                                    disabled={isGeneratingDoc || !docKeywords}
                                    className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-3 py-2 rounded text-xs font-bold flex items-center gap-2 h-[38px]"
                                >
                                    {isGeneratingDoc ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Escrever'}
                                </button>
                             </div>

                             <div>
                                <label className="text-[10px] uppercase text-slate-500 block mb-1">Conteúdo do Documento <Req/></label>
                                <textarea 
                                    value={resourceContent} 
                                    onChange={e => setResourceContent(e.target.value)} 
                                    className="w-full bg-slate-900 border border-slate-700 rounded p-3 text-sm min-h-[150px] font-serif leading-relaxed text-slate-300"
                                    placeholder="Escreva aqui o conteúdo que os jogadores lerão..."
                                ></textarea>
                             </div>
                        </div>
                    )}

                    <div className="pt-2 border-t border-slate-800">
                        <button onClick={handleAddResource} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-2 rounded flex justify-center items-center gap-2 font-bold shadow-lg">
                            <Plus className="w-4 h-4" /> Adicionar Recurso
                        </button>
                    </div>
                </div>

                {/* List of Existing Resources */}
                <div className="space-y-4">
                    {(!config.links || config.links.length === 0) && <p className="text-slate-600 italic text-center">Nenhum recurso cadastrado.</p>}
                    {(config.links || []).map(link => (
                        <div key={link.id} className="bg-slate-950/50 p-4 rounded border border-slate-800 space-y-3">
                             <div className="flex items-center justify-between">
                                 <div className="flex items-center gap-3">
                                     <div className="bg-slate-900 p-2 rounded text-slate-500">
                                         {link.category === 'MAP' && <Map className="w-4 h-4 text-blue-400" />}
                                         {link.category === 'DOC' && <FileText className="w-4 h-4 text-yellow-400" />}
                                         {link.category === 'DISCORD' && <MessageCircle className="w-4 h-4 text-indigo-400" />}
                                         {link.category === 'OTHER' && <LinkIcon className="w-4 h-4 text-slate-400" />}
                                     </div>
                                     <div className="flex flex-col">
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-slate-200">{link.title}</span>
                                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                                                {link.type === 'INTERNAL' ? 'INTERNO' : 'LINK'}
                                            </span>
                                        </div>
                                        {link.type === 'EXTERNAL' ? (
                                            <a href={link.url} target="_blank" rel="noreferrer" className="text-xs text-blue-500 hover:underline truncate max-w-[200px]">{link.url}</a>
                                        ) : (
                                            <span className="text-xs text-slate-500 italic truncate max-w-[300px]">"{link.content?.substring(0, 50)}..."</span>
                                        )}
                                     </div>
                                 </div>
                                 <button onClick={() => handleDeleteResource(link.id)} className="text-slate-600 hover:text-red-500 p-2"><Trash2 className="w-4 h-4" /></button>
                             </div>

                             {/* Visibility Controls */}
                             <div className="bg-slate-900 p-3 rounded border border-slate-800/50">
                                 <div className="flex items-center gap-2 mb-2 pb-2 border-b border-slate-800/50">
                                     <button 
                                        onClick={() => toggleResourcePublic(link.id)}
                                        className={`flex items-center gap-1 text-xs px-2 py-1 rounded transition-colors ${link.isPublic ? 'bg-emerald-900/30 text-emerald-400 border border-emerald-900/50' : 'bg-slate-800 text-slate-500'}`}
                                     >
                                         {link.isPublic ? <Globe className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                                         {link.isPublic ? 'Público (Todos)' : 'Privado (Restrito)'}
                                     </button>
                                     <span className="text-[10px] text-slate-600 uppercase tracking-wide ml-auto">Quem pode ver?</span>
                                 </div>
                                 
                                 <div className="flex flex-wrap gap-2">
                                     {availablePlayers.length === 0 && <span className="text-xs text-slate-600 italic">Nenhum jogador registrado.</span>}
                                     {availablePlayers.map(player => {
                                         const hasAccess = link.visibleTo?.includes(player);
                                         // Se público, todos têm acesso visualmente, mas o toggle manual serve para quando desligar o público
                                         const isActive = link.isPublic || hasAccess; 

                                         return (
                                             <button 
                                                 key={player}
                                                 disabled={link.isPublic}
                                                 onClick={() => toggleResourceVisibility(link.id, player)}
                                                 className={`text-xs px-2 py-1 rounded border flex items-center gap-1 transition-all ${
                                                     isActive
                                                     ? (link.isPublic ? 'bg-slate-800 text-slate-400 border-slate-700 opacity-50 cursor-not-allowed' : 'bg-amber-900/30 border-amber-600/50 text-amber-200')
                                                     : 'bg-slate-950 border-slate-800 text-slate-600 hover:border-slate-600'
                                                 }`}
                                             >
                                                 {isActive ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                                                 {player}
                                             </button>
                                         );
                                     })}
                                 </div>
                             </div>
                        </div>
                    ))}
                </div>
            </div>
        )}

        {/* --- CURRENCY TAB --- */}
        {activeTab === 'CURRENCY' && (
            <div className="animate-fade-in">
                <p className="text-sm text-slate-500 mb-4">Defina as moedas do jogo e seu peso unitário. Jogadores poderão adicionar essas moedas facilmente.</p>
                
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end mb-6 bg-slate-950 p-4 rounded-lg border border-slate-800">
                    <div className="md:col-span-6">
                         <label className="text-[10px] uppercase text-slate-500 block mb-1">Nome da Moeda <Req/></label>
                         <input type="text" value={currencyName} onChange={e => setCurrencyName(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-sm" placeholder="Ex: Peça de Ouro" />
                    </div>
                    <div className="md:col-span-5">
                         <label className="text-[10px] uppercase text-slate-500 block mb-1">Peso Unitário (kg)</label>
                         <input type="number" value={currencyWeight} onChange={e => setCurrencyWeight(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-sm" placeholder="0.01" />
                    </div>
                    <div className="md:col-span-1">
                        <button onClick={handleAddCurrency} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white p-2 rounded flex justify-center">
                            <Plus className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                <div className="space-y-2">
                    {(!config.currencies || config.currencies.length === 0) && <p className="text-slate-600 italic text-center">Nenhuma moeda configurada.</p>}
                    {(config.currencies || []).map(c => (
                        <div key={c.id} className="flex items-center justify-between bg-slate-950/50 p-3 rounded border border-slate-800">
                             <div className="flex items-center gap-3">
                                 <div className="bg-slate-900 p-2 rounded text-yellow-500">
                                     <Coins className="w-4 h-4" />
                                 </div>
                                 <div className="flex flex-col">
                                    <span className="font-bold text-slate-200">{c.name}</span>
                                    <span className="text-xs text-slate-500">{c.weightPerUnit} kg / unidade</span>
                                 </div>
                             </div>
                             <button onClick={() => handleDeleteCurrency(c.id)} className="text-slate-600 hover:text-red-500 p-2"><Trash2 className="w-4 h-4" /></button>
                        </div>
                    ))}
                </div>
            </div>
        )}

      </div>
    </div>
  );
};

export default FieldBuilder;