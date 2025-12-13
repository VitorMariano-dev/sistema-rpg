import React, { useState } from 'react';
import { User, SessionLog, CustomField, FieldType, ResourceValue } from '../types';
import { Shield, Scroll, Activity, Calendar } from 'lucide-react';

interface PlayerInspectorProps {
  logs: SessionLog[];
  fields: CustomField[];
}

const PlayerInspector: React.FC<PlayerInspectorProps> = ({ logs, fields }) => {
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);

  // Get unique list of players from logs
  const players = Array.from(new Set(logs.map(log => log.author || 'Anônimo')));
  
  // Filter logs for selected player
  const playerLogs = selectedPlayer 
    ? logs.filter(log => (log.author || 'Anônimo') === selectedPlayer).sort((a, b) => b.timestamp - a.timestamp)
    : [];

  // Get latest state (the most recent log is index 0 after sort)
  const latestState = playerLogs.length > 0 ? playerLogs[0].data : null;

  const renderResourceBar = (label: string, value: any) => {
     if (typeof value !== 'object') return null;
     const res = value as ResourceValue;
     const percentage = res.max > 0 ? (res.current / res.max) * 100 : 0;
     
     let color = 'bg-emerald-500';
     if(percentage < 30) color = 'bg-red-500';
     else if(percentage < 60) color = 'bg-yellow-500';

     return (
         <div key={label} className="mb-2">
             <div className="flex justify-between text-xs mb-1">
                 <span className="text-slate-300 font-bold">{label}</span>
                 <span className="text-slate-400">{res.current}/{res.max}</span>
             </div>
             <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                 <div className={`h-full ${color}`} style={{width: `${percentage}%`}}></div>
             </div>
         </div>
     )
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-fade-in">
      {/* Sidebar: List of Players */}
      <div className="md:col-span-1 bg-slate-900 border border-slate-800 rounded-xl p-4 h-fit">
         <h3 className="text-lg font-bold text-amber-500 cinzel mb-4 flex items-center gap-2">
             <Shield className="w-5 h-5" /> Jogadores Ativos
         </h3>
         <div className="space-y-2">
             {players.length === 0 && <p className="text-slate-500 text-sm">Nenhum jogador registrou aventuras ainda.</p>}
             {players.map(player => (
                 <button
                    key={player}
                    onClick={() => setSelectedPlayer(player)}
                    className={`w-full text-left p-3 rounded-lg transition-colors border ${
                        selectedPlayer === player 
                        ? 'bg-purple-900/30 border-purple-500 text-purple-200' 
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-800'
                    }`}
                 >
                     <span className="font-bold">{player}</span>
                 </button>
             ))}
         </div>
      </div>

      {/* Main Content: Player Sheet & History */}
      <div className="md:col-span-2 space-y-6">
          {!selectedPlayer && (
              <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-10 text-center text-slate-500 flex flex-col items-center justify-center min-h-[300px]">
                  <Activity className="w-12 h-12 mb-4 opacity-50" />
                  <p>Selecione um jogador para inspecionar sua ficha e histórico.</p>
              </div>
          )}

          {selectedPlayer && latestState && (
              <>
                {/* Current Status Card */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-5">
                        <Activity className="w-32 h-32" />
                    </div>
                    <div className="relative z-10">
                        <h2 className="text-2xl font-bold text-white cinzel mb-1">{selectedPlayer}</h2>
                        <p className="text-slate-400 text-sm mb-6">Status Atual (Baseado no último registro)</p>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                            {/* Resources Column */}
                            <div className="bg-slate-950/50 p-4 rounded-lg border border-slate-800">
                                <h4 className="text-xs uppercase tracking-wider text-slate-500 mb-3">Recursos Vitais</h4>
                                {fields.filter(f => f.type === FieldType.RESOURCE).map(field => 
                                    renderResourceBar(field.label, latestState[field.id])
                                )}
                                {fields.filter(f => f.type === FieldType.RESOURCE).length === 0 && 
                                    <p className="text-xs text-slate-600 italic">Nenhum recurso configurado.</p>
                                }
                            </div>

                            {/* Stats Column */}
                            <div className="bg-slate-950/50 p-4 rounded-lg border border-slate-800">
                                <h4 className="text-xs uppercase tracking-wider text-slate-500 mb-3">Atributos & Inventário</h4>
                                <div className="space-y-2">
                                    {fields.filter(f => f.type !== FieldType.RESOURCE && f.type !== FieldType.TEXTAREA).map(field => {
                                        const val = latestState[field.id];
                                        if (val === undefined || val === null || val === '') return null;
                                        return (
                                            <div key={field.id} className="flex justify-between text-sm border-b border-slate-800/50 pb-1 last:border-0">
                                                <span className="text-slate-400">{field.label}:</span>
                                                <span className="text-slate-200 font-medium">
                                                    {typeof val === 'object' 
                                                        ? `${(val as ResourceValue).current}/${(val as ResourceValue).max}`
                                                        : (typeof val === 'boolean' ? (val ? 'Sim' : 'Não') : val)}
                                                </span>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* History List */}
                <div className="space-y-4">
                    <h3 className="text-lg font-bold text-slate-300 flex items-center gap-2">
                        <Scroll className="w-5 h-5" /> Histórico de Sessões
                    </h3>
                    {playerLogs.map(log => (
                        <div key={log.id} className="bg-slate-900 border border-slate-800 rounded-lg p-4 hover:border-slate-700 transition-colors">
                            <div className="flex justify-between items-start mb-2">
                                <span className="text-purple-400 text-xs font-mono flex items-center gap-1">
                                    <Calendar className="w-3 h-3" />
                                    {new Date(log.timestamp).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'})}
                                </span>
                            </div>
                            {log.summary ? (
                                <p className="text-slate-300 text-sm italic border-l-2 border-purple-500 pl-3">"{log.summary}"</p>
                            ) : (
                                <p className="text-slate-500 text-xs italic">Sem resumo gerado.</p>
                            )}
                        </div>
                    ))}
                </div>
              </>
          )}
      </div>
    </div>
  );
};

export default PlayerInspector;