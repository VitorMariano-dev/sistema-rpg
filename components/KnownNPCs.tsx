import React from 'react';
import { Skull, Heart, Zap, User, Search } from 'lucide-react';
import { CampaignConfig, NPC } from '../types';

interface KnownNPCsProps {
  config: CampaignConfig;
  currentUser: string;
}

const KnownNPCs: React.FC<KnownNPCsProps> = ({ config, currentUser }) => {
  // Filter NPCs that include the current user in 'discoveredBy'
  const knownNPCs = (config.npcs || []).filter(npc => 
    (npc.discoveredBy || []).includes(currentUser)
  );

  if (knownNPCs.length === 0) {
      return (
          <div className="flex flex-col items-center justify-center py-20 bg-slate-900/50 border border-slate-800 rounded-xl animate-fade-in">
              <Search className="w-16 h-16 text-slate-700 mb-4" />
              <h3 className="text-xl font-bold text-slate-400 cinzel">Conhecimento Oculto</h3>
              <p className="text-slate-500 mt-2 max-w-md text-center">
                  Você ainda não descobriu informações suficientes sobre as criaturas e personagens deste mundo. Continue explorando para preencher seu bestiário.
              </p>
          </div>
      );
  }

  return (
    <div className="animate-fade-in space-y-6 pb-20">
       <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-slate-100 cinzel mb-2 flex items-center justify-center gap-3">
                <Skull className="w-8 h-8 text-amber-500" /> Bestiário Conhecido
            </h2>
            <p className="text-slate-400">Registros de criaturas e pessoas encontradas em sua jornada.</p>
       </div>

       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
           {knownNPCs.map(npc => (
               <div key={npc.id} className="bg-slate-900 border border-slate-800 rounded-xl p-5 hover:border-amber-500/30 transition-colors shadow-lg flex flex-col">
                   <div className="flex items-start gap-4 mb-4">
                       <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                           <User className="w-8 h-8 text-slate-400" />
                       </div>
                       <div>
                           <h3 className="text-xl font-bold text-slate-200 cinzel">{npc.name}</h3>
                           <span className="text-xs text-amber-500/80 uppercase tracking-widest font-bold">Encontrado</span>
                       </div>
                   </div>

                   <div className="flex-1 bg-slate-950/50 p-4 rounded-lg border border-slate-800/50 mb-4">
                       <p className="text-sm text-slate-300 italic leading-relaxed">
                           "{npc.publicDescription || npc.description}"
                       </p>
                   </div>
               </div>
           ))}
       </div>
    </div>
  );
};

export default KnownNPCs;