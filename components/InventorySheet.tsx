import React, { useState, useEffect } from 'react';
import { InventoryItem, Equipment, CharacterSheetState, ItemCategory, CurrencyType } from '../types';
import { Backpack, Shirt, Shield, Footprints, Weight, Plus, X, Edit2, Hammer, Coins, AlertCircle } from 'lucide-react';

interface InventorySheetProps {
  state: CharacterSheetState;
  onChange: (newState: CharacterSheetState) => void;
  currencies?: CurrencyType[];
}

const InventorySheet: React.FC<InventorySheetProps> = ({ state, onChange, currencies = [] }) => {
  // Local state for adding/editing items
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [weight, setWeight] = useState('');
  const [qty, setQty] = useState('1');
  const [category, setCategory] = useState<ItemCategory>('GENERAL');
  
  // Logic for currency selection
  const [selectedCurrencyId, setSelectedCurrencyId] = useState<string>('');
  
  // Validation State
  const [error, setError] = useState<string | null>(null);

  // Specific fields for Armor/Weapon
  const [defense, setDefense] = useState('');
  const [durability, setDurability] = useState('');
  const [maxDurability, setMaxDurability] = useState('');

  // Calculate total weight
  const totalWeight = state.inventory.reduce((acc, item) => acc + (item.weight * item.quantity), 0);
  const weightPercentage = state.maxWeight > 0 ? (totalWeight / state.maxWeight) * 100 : 0;
  
  let weightColor = 'bg-emerald-500';
  if (weightPercentage > 80) weightColor = 'bg-yellow-500';
  if (weightPercentage > 100) weightColor = 'bg-red-500 animate-pulse';

  // Effect to auto-fill currency details
  useEffect(() => {
      if (category === 'CURRENCY' && selectedCurrencyId) {
          const currency = currencies.find(c => c.id === selectedCurrencyId);
          if (currency) {
              setName(currency.name);
              setWeight(currency.weightPerUnit.toString());
          }
      }
  }, [selectedCurrencyId, category, currencies]);

  const resetForm = () => {
      setEditingId(null);
      setName('');
      setWeight('');
      setQty('1');
      setCategory('GENERAL');
      setDefense('');
      setDurability('');
      setMaxDurability('');
      setSelectedCurrencyId('');
      setError(null);
  };

  const handleEditItem = (item: InventoryItem) => {
      setError(null);
      setEditingId(item.id);
      setName(item.name);
      setWeight(item.weight.toString());
      setQty(item.quantity.toString());
      setCategory(item.category || 'GENERAL');
      setDefense(item.defense?.toString() || '');
      setDurability(item.durability?.toString() || '');
      setMaxDurability(item.maxDurability?.toString() || '');
      
      if (item.category === 'CURRENCY') {
          const matched = currencies.find(c => c.name === item.name);
          if (matched) setSelectedCurrencyId(matched.id);
      } else {
          setSelectedCurrencyId('');
      }
  };

  const handleSaveItem = () => {
      setError(null);

      // Validation
      if (!name.trim()) {
          setError('O nome do item é obrigatório.');
          return;
      }
      if (!qty || parseInt(qty) <= 0) {
          setError('A quantidade deve ser maior que zero.');
          return;
      }
      if (weight === '' || parseFloat(weight) < 0) {
          setError('O peso é obrigatório (pode ser 0).');
          return;
      }

      // Mantém campos que o formulário não edita (ex.: notes) ao salvar uma edição
      const existing = editingId ? state.inventory.find(i => i.id === editingId) : undefined;
      const itemData: InventoryItem = {
          ...existing,
          id: editingId || crypto.randomUUID(),
          name,
          weight: parseFloat(weight) || 0,
          quantity: parseInt(qty) || 1,
          category,
          defense: category === 'ARMOR' ? (parseFloat(defense) || 0) : undefined,
          durability: category === 'ARMOR' ? (parseFloat(durability) || 0) : undefined,
          maxDurability: category === 'ARMOR' ? (parseFloat(maxDurability) || 0) : undefined,
      };

      if (itemData.durability !== undefined && itemData.maxDurability !== undefined) {
          if (itemData.durability > itemData.maxDurability) itemData.durability = itemData.maxDurability;
      }

      if (editingId) {
          onChange({
              ...state,
              inventory: state.inventory.map(i => i.id === editingId ? itemData : i)
          });
      } else {
          onChange({
              ...state,
              inventory: [...state.inventory, itemData]
          });
      }

      resetForm();
  };

  const handleRemoveItem = (id: string) => {
      onChange({
          ...state,
          inventory: state.inventory.filter(i => i.id !== id)
      });
  };

  const handleEquipmentChange = (slot: keyof Equipment, value: string) => {
      onChange({
          ...state,
          equipment: {
              ...state.equipment,
              [slot]: value
          }
      });
  };

  const getCategoryLabel = (cat: ItemCategory) => {
      switch(cat) {
          case 'ARMOR': return 'Armadura';
          case 'WEAPON': return 'Arma';
          case 'CONSUMABLE': return 'Consumível';
          case 'VALUABLE': return 'Tesouro';
          case 'CURRENCY': return 'Moeda';
          default: return 'Geral';
      }
  };

  // Helper for Required Asterisk
  const Req = () => <span className="text-red-500 ml-1">*</span>;

  return (
    <div className="bg-slate-950 border border-slate-800 rounded-xl p-6 mt-8">
        <h3 className="text-xl font-bold text-amber-500 flex items-center gap-2 mb-6">
            <Backpack className="w-5 h-5" /> Equipamento & Carga
        </h3>

        {/* EQUIPMENT SLOTS */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-slate-900 border border-slate-800 p-3 rounded-lg flex flex-col items-center">
                <Shield className="w-6 h-6 text-slate-500 mb-2" />
                <span className="text-xs uppercase text-slate-500 mb-1">Cabeça</span>
                <input 
                    type="text" 
                    className="w-full bg-slate-950 text-center text-sm border-b border-slate-700 focus:border-amber-500 outline-none pb-1"
                    placeholder="Capacete"
                    value={state.equipment.head}
                    onChange={(e) => handleEquipmentChange('head', e.target.value)}
                />
            </div>
            <div className="bg-slate-900 border border-slate-800 p-3 rounded-lg flex flex-col items-center">
                <Shirt className="w-6 h-6 text-slate-500 mb-2" />
                <span className="text-xs uppercase text-slate-500 mb-1">Torso</span>
                <input 
                    type="text" 
                    className="w-full bg-slate-950 text-center text-sm border-b border-slate-700 focus:border-amber-500 outline-none pb-1"
                    placeholder="Armadura"
                    value={state.equipment.chest}
                    onChange={(e) => handleEquipmentChange('chest', e.target.value)}
                />
            </div>
            <div className="bg-slate-900 border border-slate-800 p-3 rounded-lg flex flex-col items-center">
                <div className="w-6 h-6 text-slate-500 mb-2 flex items-center justify-center font-bold text-xs border border-slate-500 rounded">Leg</div>
                <span className="text-xs uppercase text-slate-500 mb-1">Pernas</span>
                <input 
                    type="text" 
                    className="w-full bg-slate-950 text-center text-sm border-b border-slate-700 focus:border-amber-500 outline-none pb-1"
                    placeholder="Calças/Grevas"
                    value={state.equipment.legs}
                    onChange={(e) => handleEquipmentChange('legs', e.target.value)}
                />
            </div>
            <div className="bg-slate-900 border border-slate-800 p-3 rounded-lg flex flex-col items-center">
                <Footprints className="w-6 h-6 text-slate-500 mb-2" />
                <span className="text-xs uppercase text-slate-500 mb-1">Pés</span>
                <input 
                    type="text" 
                    className="w-full bg-slate-950 text-center text-sm border-b border-slate-700 focus:border-amber-500 outline-none pb-1"
                    placeholder="Botas"
                    value={state.equipment.feet}
                    onChange={(e) => handleEquipmentChange('feet', e.target.value)}
                />
            </div>
        </div>

        {/* WEIGHT BAR */}
        <div className="mb-6">
            <div className="flex justify-between text-sm mb-1">
                <span className="flex items-center gap-2 text-slate-300">
                    <Weight className="w-4 h-4" /> Peso da Bolsa
                </span>
                <div className="flex items-center gap-2">
                     <span className={`${weightPercentage > 100 ? 'text-red-500 font-bold' : 'text-slate-400'}`}>
                         {totalWeight.toFixed(3)} kg
                     </span>
                     <span className="text-slate-600">/</span>
                     <input 
                        type="number" 
                        className="bg-transparent border-b border-slate-700 w-16 text-center text-slate-300 outline-none focus:border-amber-500"
                        value={state.maxWeight}
                        onChange={(e) => onChange({...state, maxWeight: parseFloat(e.target.value) || 0})}
                     />
                     <span className="text-xs text-slate-500">Máx</span>
                </div>
            </div>
            <div className="h-3 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                <div 
                    className={`h-full ${weightColor} transition-all duration-500`}
                    style={{ width: `${Math.min(weightPercentage, 100)}%` }}
                ></div>
            </div>
            {weightPercentage > 100 && (
                <p className="text-center text-xs text-red-500 mt-1 font-bold animate-pulse">PERSONAGEM SOBRECARREGADO - MOVIMENTO REDUZIDO</p>
            )}
        </div>

        {/* ADD/EDIT ITEM FORM */}
        <div className="bg-slate-900/30 p-4 rounded border border-slate-800 mb-4 transition-all">
             <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-start">
                
                {/* 1. Category Selection */}
                <div className="md:col-span-3">
                    <label className="text-[10px] uppercase text-slate-500 block mb-1">Categoria <Req/></label>
                    <select 
                        value={category}
                        onChange={(e) => {
                            setCategory(e.target.value as ItemCategory);
                            setSelectedCurrencyId(''); // Reset currency if cat changes
                            if (e.target.value !== 'CURRENCY') {
                                // Reset locked fields if moving away from currency
                                if(category === 'CURRENCY') {
                                    setName('');
                                    setWeight('');
                                }
                            }
                        }}
                        className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-sm text-slate-300 focus:border-amber-500 outline-none"
                    >
                        <option value="GENERAL">Geral</option>
                        <option value="WEAPON">Arma</option>
                        <option value="ARMOR">Armadura</option>
                        <option value="CONSUMABLE">Consumível</option>
                        <option value="VALUABLE">Tesouro</option>
                        <option value="CURRENCY">Moeda</option>
                    </select>
                </div>

                {/* 2. Name / Currency Selector */}
                <div className="md:col-span-4">
                    {category === 'CURRENCY' && currencies.length > 0 ? (
                        <>
                            <label className="text-[10px] uppercase text-slate-500 block mb-1 flex items-center gap-1">
                                <Coins className="w-3 h-3 text-yellow-500"/> Tipo de Moeda <Req/>
                            </label>
                            <select 
                                value={selectedCurrencyId}
                                onChange={(e) => setSelectedCurrencyId(e.target.value)}
                                className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-sm text-yellow-500 focus:border-yellow-500 outline-none"
                            >
                                <option value="">-- Selecione a Moeda --</option>
                                {currencies.map(c => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
                        </>
                    ) : (
                        <>
                            <label className="text-[10px] uppercase text-slate-500 block mb-1">Nome do Item <Req/></label>
                            <input 
                                type="text" 
                                placeholder="Ex: Espada Longa"
                                className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-sm text-white focus:border-amber-500 outline-none"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                            />
                        </>
                    )}
                </div>

                {/* 3. Quantity */}
                <div className="md:col-span-2">
                    <label className="text-[10px] uppercase text-slate-500 block mb-1">Qtd <Req/></label>
                    <input 
                        type="number" 
                        min="1"
                        className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-sm text-white text-center focus:border-amber-500 outline-none"
                        value={qty}
                        onChange={(e) => setQty(e.target.value)}
                    />
                </div>

                {/* 4. Unit Weight */}
                <div className="md:col-span-2">
                     <label className="text-[10px] uppercase text-slate-500 block mb-1">Peso Unit. (Kg) <Req/></label>
                     <input 
                        type="number" 
                        step="0.001"
                        className={`w-full bg-slate-950 border border-slate-700 rounded p-2 text-sm text-white text-center focus:border-amber-500 outline-none ${selectedCurrencyId ? 'opacity-50 cursor-not-allowed' : ''}`}
                        value={weight}
                        onChange={(e) => setWeight(e.target.value)}
                        readOnly={!!selectedCurrencyId} // Locked for currency
                        title={selectedCurrencyId ? "Definido automaticamente pelo tipo de moeda" : ""}
                    />
                </div>

                {/* 5. Action Button */}
                <div className="md:col-span-1 pt-0 md:pt-6">
                    <button 
                        onClick={handleSaveItem} 
                        className={`w-full p-2 rounded flex items-center justify-center transition-colors shadow-lg ${editingId ? 'bg-amber-600 hover:bg-amber-500' : 'bg-emerald-600 hover:bg-emerald-500'}`}
                        title={editingId ? "Salvar Alterações" : "Adicionar Item"}
                    >
                        {editingId ? <Edit2 className="w-4 h-4 text-white" /> : <Plus className="w-4 h-4 text-white" />}
                    </button>
                </div>
             </div>
            
             {/* Total weight calculation preview for the item being added */}
             {(weight && qty) && (
                 <div className="text-right mt-1 mr-14">
                     <span className="text-[10px] text-slate-500">Peso Total do Lote: <span className="text-slate-300 font-mono">{(parseFloat(weight) * parseInt(qty || '0')).toFixed(3)} kg</span></span>
                 </div>
             )}

             {/* Validation Error Message */}
             {error && (
                 <div className="mt-3 p-2 bg-red-950/30 border border-red-900/50 rounded flex items-center gap-2 text-xs text-red-400 animate-pulse">
                     <AlertCircle className="w-3 h-3" /> {error}
                 </div>
             )}

             {/* Armor Specific Fields */}
             {category === 'ARMOR' && (
                 <div className="grid grid-cols-3 gap-3 mt-3 pt-3 border-t border-slate-800/50 animate-fade-in">
                     <div>
                         <label className="text-[10px] uppercase text-slate-500 block mb-1 flex items-center gap-1"><Shield className="w-3 h-3"/> Defesa</label>
                         <input type="number" value={defense} onChange={(e) => setDefense(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-sm" placeholder="CA/Def" />
                     </div>
                     <div>
                         <label className="text-[10px] uppercase text-slate-500 block mb-1 flex items-center gap-1"><Hammer className="w-3 h-3"/> Durabilidade</label>
                         <input type="number" value={durability} onChange={(e) => setDurability(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-sm" placeholder="Atual" />
                     </div>
                     <div>
                         <label className="text-[10px] uppercase text-slate-500 block mb-1">Max</label>
                         <input type="number" value={maxDurability} onChange={(e) => setMaxDurability(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-sm" placeholder="Max" />
                     </div>
                 </div>
             )}
             
             {editingId && (
                 <div className="mt-2 text-right">
                     <button onClick={resetForm} className="text-xs text-slate-500 hover:text-slate-300 underline">Cancelar Edição</button>
                 </div>
             )}
        </div>

        {/* INVENTORY LIST */}
        <div className="space-y-2">
            <div className="grid grid-cols-12 gap-2 text-xs uppercase text-slate-500 font-bold tracking-wider px-2">
                <div className="col-span-5">Item</div>
                <div className="col-span-3">Tipo</div>
                <div className="col-span-2 text-center">Qtd</div>
                <div className="col-span-2 text-center">Peso Total</div>
            </div>

            {state.inventory.map(item => (
                <div 
                    key={item.id} 
                    onClick={() => handleEditItem(item)}
                    className="grid grid-cols-12 gap-2 items-center bg-slate-900/50 p-3 rounded hover:bg-slate-900 border border-slate-800/50 cursor-pointer group transition-all"
                >
                    <div className="col-span-5">
                        <span className="font-medium text-slate-200 block truncate">{item.name}</span>
                        {item.category === 'ARMOR' && (
                            <div className="text-[10px] text-slate-500 flex gap-2 mt-1">
                                <span className="flex items-center gap-1"><Shield className="w-3 h-3"/> {item.defense}</span>
                                <span className="flex items-center gap-1"><Hammer className="w-3 h-3"/> {item.durability}/{item.maxDurability}</span>
                            </div>
                        )}
                        {item.category === 'CURRENCY' && (
                            <div className="text-[10px] text-yellow-500/70 flex gap-2 mt-1">
                                <span className="flex items-center gap-1">{item.weight} kg/un</span>
                            </div>
                        )}
                    </div>
                    <div className="col-span-3">
                         <span className={`text-[10px] px-2 py-1 rounded border ${item.category === 'CURRENCY' ? 'bg-yellow-900/20 text-yellow-500 border-yellow-900/50' : 'bg-slate-800 text-slate-400 border-slate-700'}`}>
                             {getCategoryLabel(item.category || 'GENERAL')}
                         </span>
                    </div>
                    <div className="col-span-2 text-center text-slate-400 font-mono">{item.quantity}</div>
                    <div className="col-span-2 flex items-center justify-between">
                         <span className="text-slate-400 font-mono text-xs text-center w-full">
                             {(item.weight * item.quantity).toFixed(3)} kg
                         </span>
                         <button 
                            onClick={(e) => { e.stopPropagation(); handleRemoveItem(item.id); }} 
                            className="text-slate-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            ))}
            
            {state.inventory.length === 0 && (
                <p className="text-center text-slate-600 italic text-sm py-4">Sua bolsa está vazia.</p>
            )}
        </div>
    </div>
  );
};

export default InventorySheet;