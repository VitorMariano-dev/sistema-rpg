import React, { useState } from 'react';
import { CampaignConfig, ExternalLink, User } from '../types';
import { Map, FileText, MessageCircle, Link as LinkIcon, ExternalLink as ExternalLinkIcon, Lock, Scroll, X } from 'lucide-react';

interface ResourceListProps {
  config: CampaignConfig;
  currentUser?: User | null;
}

const ResourceList: React.FC<ResourceListProps> = ({ config, currentUser }) => {
  const [selectedDoc, setSelectedDoc] = useState<ExternalLink | null>(null);

  const links = config.links || [];
  
  // Filter Logic:
  // GM sees everything.
  // Player sees if isPublic OR their username is in visibleTo
  const filteredLinks = links.filter(link => {
      if (!currentUser) return false;
      if (currentUser.role === 'GM') return true;
      return link.isPublic || (link.visibleTo && link.visibleTo.includes(currentUser.username));
  });

  if (filteredLinks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 bg-slate-900/50 border border-slate-800 rounded-xl animate-fade-in">
        <Map className="w-16 h-16 text-slate-700 mb-4" />
        <h3 className="text-xl font-bold text-slate-400 cinzel">Mundo Inexplorado</h3>
        <p className="text-slate-500 mt-2 max-w-md text-center">
            Nenhum recurso está disponível para você no momento.
        </p>
      </div>
    );
  }

  const getIcon = (cat: string) => {
      switch(cat) {
          case 'MAP': return <Map className="w-6 h-6 text-blue-400" />;
          case 'DOC': return <FileText className="w-6 h-6 text-yellow-400" />;
          case 'DISCORD': return <MessageCircle className="w-6 h-6 text-indigo-400" />;
          default: return <LinkIcon className="w-6 h-6 text-slate-400" />;
      }
  };

  const getLabel = (cat: string) => {
      switch(cat) {
          case 'MAP': return 'Cartografia';
          case 'DOC': return 'Documento';
          case 'DISCORD': return 'Comunicação';
          default: return 'Link';
      }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in pb-20 relative">
       <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-slate-100 cinzel mb-2 flex items-center justify-center gap-3">
                <Map className="w-8 h-8 text-amber-500" /> Recursos do Mundo
            </h2>
            <p className="text-slate-400">Mapas, canais de comunicação e documentos sagrados.</p>
       </div>

       <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
           {filteredLinks.map(link => {
               if (link.type === 'INTERNAL') {
                   // Internal Document Card
                   return (
                        <button 
                            key={link.id} 
                            onClick={() => setSelectedDoc(link)}
                            className="bg-slate-900 border border-slate-800 rounded-xl p-6 flex items-center gap-4 hover:border-amber-500/50 hover:bg-slate-900/80 transition-all group text-left w-full"
                        >
                            <div className="bg-slate-950 p-4 rounded-full border border-slate-800 group-hover:border-slate-700 transition-colors">
                                {getIcon(link.category)}
                            </div>
                            <div className="flex-1">
                                <div className="flex justify-between items-start">
                                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1 block">{getLabel(link.category)}</span>
                                    {!link.isPublic && (
                                        <div title="Restrito">
                                            <Lock className="w-3 h-3 text-red-500" />
                                        </div>
                                    )}
                                </div>
                                <h3 className="text-lg font-bold text-slate-200 group-hover:text-amber-500 transition-colors">{link.title}</h3>
                                <span className="text-xs text-slate-600 truncate block max-w-[250px] flex items-center gap-1">
                                    <Scroll className="w-3 h-3" /> Ler documento...
                                </span>
                            </div>
                        </button>
                   );
               } else {
                   // External Link Card
                   return (
                        <a 
                            key={link.id} 
                            href={link.url} 
                            target="_blank" 
                            rel="noreferrer"
                            className="bg-slate-900 border border-slate-800 rounded-xl p-6 flex items-center gap-4 hover:border-amber-500/50 hover:bg-slate-900/80 transition-all group"
                        >
                            <div className="bg-slate-950 p-4 rounded-full border border-slate-800 group-hover:border-slate-700 transition-colors">
                                {getIcon(link.category)}
                            </div>
                            <div className="flex-1">
                                <div className="flex justify-between items-start">
                                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1 block">{getLabel(link.category)}</span>
                                    {!link.isPublic && (
                                        <div title="Restrito">
                                            <Lock className="w-3 h-3 text-red-500" />
                                        </div>
                                    )}
                                </div>
                                <h3 className="text-lg font-bold text-slate-200 group-hover:text-amber-500 transition-colors">{link.title}</h3>
                                <span className="text-xs text-slate-600 truncate block max-w-[250px]">{link.url}</span>
                            </div>
                            <ExternalLinkIcon className="w-5 h-5 text-slate-600 group-hover:text-amber-500" />
                        </a>
                   );
               }
           })}
       </div>

       {/* Internal Doc Modal/Reader */}
       {selectedDoc && (
           <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in" onClick={() => setSelectedDoc(null)}>
               <div className="bg-[#eaddcf] text-slate-900 w-full max-w-2xl rounded-sm shadow-2xl p-8 relative max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                    <button 
                        onClick={() => setSelectedDoc(null)}
                        className="absolute top-4 right-4 text-slate-500 hover:text-red-900 transition-colors"
                    >
                        <X className="w-6 h-6" />
                    </button>
                    
                    <div className="border-4 border-double border-slate-900/20 p-6 h-full">
                        <h2 className="text-3xl font-bold cinzel text-center mb-6 text-slate-900 border-b border-slate-900/10 pb-4">
                            {selectedDoc.title}
                        </h2>
                        <div className="font-serif text-lg leading-relaxed whitespace-pre-wrap">
                            {selectedDoc.content}
                        </div>
                    </div>
               </div>
           </div>
       )}
    </div>
  );
};

export default ResourceList;