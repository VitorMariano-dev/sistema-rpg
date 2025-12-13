import React, { useState, useEffect } from 'react';
import { Save, Loader2, Sparkles, Heart } from 'lucide-react';
import { CampaignConfig, SessionLog, FieldType, ResourceValue, CharacterSheetState, SessionData } from '../types';
import { summarizeSessionLog } from '../services/geminiService';
import InventorySheet from './InventorySheet';

interface SessionLoggerProps {
  config: CampaignConfig;
  onSaveLog: (log: SessionLog) => void;
  currentUser: string;
}

const SessionLogger: React.FC<SessionLoggerProps> = ({ config, onSaveLog, currentUser }) => {
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [characterState, setCharacterState] = useState<CharacterSheetState>({
      inventory: [],
      equipment: { head: '', chest: '', legs: '', feet: '' },
      maxWeight: 50 // Default 50kg
  });
  
  const [isSummarizing, setIsSummarizing] = useState(false);

  // Helper for Required Asterisk (though campaign fields are usually optional, it's good to indicate if important)
  // For now, we assume Campaign Fields configured by GM are "Standard", maybe not strictly mandatory for saving, 
  // but let's visually align with the request "show mandatory fields". 
  // Since we don't have a "required" flag on CustomField, we will treat them as open, 
  // but we can add a small indicator if we wanted to enforce it. 
  // However, the prompt implies "throughout the system". 
  // Let's assume standard fields are just fields. 
  // But let's add the visual cue if we were to enforce it. 
  // For now, let's keep it clean as we don't block saving on empty fields here.

  // Load previous state on mount
  useEffect(() => {
      const allLogsStr = localStorage.getItem('rpg_logs');
      if (allLogsStr) {
          const allLogs: SessionLog[] = JSON.parse(allLogsStr);
          // Filter logs by current user and sort by date descending
          const userLogs = allLogs
            .filter(l => (l.author || 'Anônimo') === currentUser)
            .sort((a, b) => b.timestamp - a.timestamp);
          
          if (userLogs.length > 0) {
              const lastData = userLogs[0].data;
              
              // Restore Fields
              const restoredFields: Record<string, any> = {};
              config.fields.forEach(f => {
                  if (lastData[f.id] !== undefined) {
                      restoredFields[f.id] = lastData[f.id];
                  }
              });
              setFormData(restoredFields);

              // Restore Character Sheet (Inventory/Equipment)
              if (lastData.characterSheet) {
                  setCharacterState(lastData.characterSheet as CharacterSheetState);
              }
          }
      }
  }, [currentUser, config.fields]);

  const handleInputChange = (id: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [id]: value
    }));
  };

  const handleResourceChange = (id: string, field: 'current' | 'max', value: string) => {
    setFormData(prev => {
        const currentResource = prev[id] as ResourceValue || { current: 0, max: 0 };
        const numValue = Number(value);
        
        let newCurrent = currentResource.current;
        let newMax = currentResource.max;

        if (field === 'max') {
            newMax = numValue;
            // If max drops below current, clamp current
            if (newCurrent > newMax) newCurrent = newMax;
        } else {
            // If setting current, clamp to max
            newCurrent = numValue;
            if (newCurrent > newMax) newCurrent = newMax;
        }

        return {
            ...prev,
            [id]: {
                current: newCurrent,
                max: newMax
            }
        }
    });
  };

  const handleSave = async () => {
    // Allows saving even if fields are empty, but inventory might have changed
    
    let summary = "";
    setIsSummarizing(true);
    try {
        summary = await summarizeSessionLog(formData, config.fields);
    } catch(e) {
        console.error("AI Summary failed", e);
    } finally {
        setIsSummarizing(false);
    }

    const sessionData: SessionData = {
        ...formData,
        characterSheet: characterState // Persist character sheet state inside the log
    };

    const newLog: SessionLog = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      data: sessionData,
      summary: summary,
      author: currentUser
    };

    onSaveLog(newLog);
    alert("Sessão registrada com sucesso!");
    // We do NOT clear form data here, so the player can continue editing for the next session/same session
  };

  const renderResourceField = (fieldId: string, label: string) => {
      const resource = (formData[fieldId] as ResourceValue) || { current: 0, max: 0 };
      const percentage = resource.max > 0 ? Math.min(100, Math.max(0, (resource.current / resource.max) * 100)) : 0;
      
      let barColor = 'bg-emerald-500';
      if (percentage < 30) barColor = 'bg-red-500';
      else if (percentage < 60) barColor = 'bg-yellow-500';

      return (
          <div className="bg-slate-950 border border-slate-700 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                  <span className="text-slate-300 font-bold flex items-center gap-2">
                    <Heart className="w-4 h-4 text-red-500" /> {label}
                  </span>
                  <span className="text-xs text-slate-500 font-mono">{percentage.toFixed(0)}%</span>
              </div>
              
              <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden shadow-inner">
                  <div 
                    className={`h-full ${barColor} transition-all duration-500 ease-out shadow-[0_0_10px_rgba(0,0,0,0.5)]`} 
                    style={{ width: `${percentage}%` }}
                  ></div>
              </div>

              <div className="flex items-center gap-2">
                  <div className="flex-1">
                      <label className="block text-[10px] uppercase text-slate-500 mb-1">Atual</label>
                      <input 
                        type="number"
                        className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white font-mono text-center focus:border-amber-500 outline-none"
                        value={resource.current || ''}
                        onChange={(e) => handleResourceChange(fieldId, 'current', e.target.value)}
                        placeholder="0"
                      />
                  </div>
                  <span className="text-slate-600 font-bold text-xl mt-4">/</span>
                  <div className="flex-1">
                      <label className="block text-[10px] uppercase text-slate-500 mb-1">Máximo</label>
                      <input 
                        type="number"
                        className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-slate-400 font-mono text-center focus:border-amber-500 outline-none"
                        value={resource.max || ''}
                        onChange={(e) => handleResourceChange(fieldId, 'max', e.target.value)}
                        placeholder="0"
                      />
                  </div>
              </div>
          </div>
      );
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8 animate-fade-in pb-20">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-slate-100 cinzel mb-2">{config.title || "Campanha Sem Título"}</h2>
        <p className="text-slate-400">{config.description}</p>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 md:p-8 shadow-2xl">
        <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-amber-500 flex items-center gap-2">
                <Sparkles className="w-5 h-5" /> Ficha de Personagem & Registro
            </h3>
            <div className="text-right">
                <span className="text-xs text-slate-500 block">Aventureiro</span>
                <span className="text-sm font-bold text-slate-200">{currentUser}</span>
            </div>
        </div>

        {/* Dynamic Fields */}
        <div className="space-y-6">
            {config.fields.map((field) => (
                <div key={field.id} className="space-y-2">
                    {field.type !== FieldType.RESOURCE && (
                         <>
                            <label className="block text-sm font-semibold text-slate-300">
                                {field.label}
                            </label>
                            {field.description && (
                                <p className="text-xs text-slate-500 mb-1">{field.description}</p>
                            )}
                         </>
                    )}
                   
                    {field.type === FieldType.TEXT && (
                        <input
                            type="text"
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-slate-100 focus:ring-2 focus:ring-amber-500 focus:outline-none transition-all"
                            placeholder={field.placeholder || "Digite os detalhes..."}
                            value={formData[field.id] || ''}
                            onChange={(e) => handleInputChange(field.id, e.target.value)}
                        />
                    )}

                    {field.type === FieldType.TEXTAREA && (
                        <textarea
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-slate-100 focus:ring-2 focus:ring-amber-500 focus:outline-none min-h-[120px] transition-all"
                            placeholder={field.placeholder || "Digite os detalhes..."}
                            value={formData[field.id] || ''}
                            onChange={(e) => handleInputChange(field.id, e.target.value)}
                        />
                    )}

                    {field.type === FieldType.NUMBER && (
                        <input
                            type="number"
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-slate-100 focus:ring-2 focus:ring-amber-500 focus:outline-none transition-all"
                            placeholder="0"
                            value={formData[field.id] || ''}
                            onChange={(e) => handleInputChange(field.id, e.target.value)}
                        />
                    )}

                    {field.type === FieldType.CHECKBOX && (
                        <div className="flex items-center gap-3 bg-slate-950 p-3 rounded-lg border border-slate-700">
                            <input
                                type="checkbox"
                                id={field.id}
                                className="w-5 h-5 text-amber-600 rounded focus:ring-amber-500 bg-slate-900 border-slate-600"
                                checked={!!formData[field.id]}
                                onChange={(e) => handleInputChange(field.id, e.target.checked)}
                            />
                            <label htmlFor={field.id} className="text-sm text-slate-300 cursor-pointer select-none">
                                {field.label} (Sim/Não)
                            </label>
                        </div>
                    )}

                    {field.type === FieldType.RESOURCE && renderResourceField(field.id, field.label)}
                </div>
            ))}

            {config.fields.length === 0 && (
                <div className="text-center py-4 border border-dashed border-slate-800 rounded-lg">
                    <p className="text-slate-500 text-sm">O mestre ainda não configurou campos customizados.</p>
                </div>
            )}
        </div>

        {/* INVENTORY SHEET */}
        <InventorySheet state={characterState} onChange={setCharacterState} currencies={config.currencies} />

        <div className="mt-8 pt-6 border-t border-slate-800">
            <button
                onClick={handleSave}
                disabled={isSummarizing}
                className="w-full bg-amber-600 hover:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-lg font-bold py-4 rounded-xl shadow-lg shadow-amber-900/20 transition-all active:scale-[0.98] flex items-center justify-center gap-3"
            >
                {isSummarizing ? (
                    <>
                        <Loader2 className="w-6 h-6 animate-spin" />
                        <span>Escrevendo detalhes nos arquivos...</span>
                    </>
                ) : (
                    <>
                        <Save className="w-6 h-6" />
                        <span>Salvar Estado & Registrar</span>
                    </>
                )}
            </button>
            <p className="text-center text-xs text-slate-600 mt-2">
                * Um Escriba de IA tentará resumir suas anotações ao salvar.
            </p>
        </div>
      </div>
    </div>
  );
};

export default SessionLogger;