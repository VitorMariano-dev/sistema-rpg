import React, { useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';
import { SessionLog, CustomField, FieldType } from '../types';
import { buildChartData, getLogAuthor } from '../utils';

interface CampaignAnalyticsProps {
  logs: SessionLog[];
  fields: CustomField[];
  currentUser?: string;
}

const CampaignAnalytics: React.FC<CampaignAnalyticsProps> = ({ logs, fields, currentUser }) => {
  // Find numeric fields to chart (Including RESOURCE types)
  const numericFields = fields.filter(f => f.type === FieldType.NUMBER || f.type === FieldType.RESOURCE);

  // Each player has their own progression, so the chart shows one player at a time
  const players = Array.from(new Set(logs.map(getLogAuthor)));
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);
  const player = selectedPlayer && players.includes(selectedPlayer)
    ? selectedPlayer
    : (currentUser && players.includes(currentUser) ? currentUser : players[0]);

  if (numericFields.length === 0 || logs.length === 0) {
    return (
      <div className="p-8 text-center text-slate-500 border border-slate-800 rounded-lg bg-slate-900/50">
        <p>Adicione campos numéricos ou de recurso e registre algumas sessões para ver as análises.</p>
      </div>
    );
  }

  const data = buildChartData(logs, fields, player);

  const colors = ['#f59e0b', '#8b5cf6', '#ec4899', '#10b981', '#3b82f6'];

  return (
    <div className="w-full h-80 bg-slate-900/50 p-4 pb-12 rounded-xl border border-slate-800">
      <div className="flex items-center justify-between gap-4 mb-4">
        <h3 className="text-lg font-bold text-slate-300 cinzel">Evolução dos Recursos</h3>
        {players.length > 1 && (
          <select
            value={player}
            onChange={(e) => setSelectedPlayer(e.target.value)}
            className="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-sm text-slate-200 focus:border-amber-500 outline-none"
            aria-label="Jogador"
          >
            {players.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        )}
      </div>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={data}
          margin={{
            top: 5,
            right: 30,
            left: 20,
            bottom: 5,
          }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
          <XAxis dataKey="name" stroke="#64748b" />
          <YAxis stroke="#64748b" />
          <Tooltip
            contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#f1f5f9' }}
            itemStyle={{ color: '#e2e8f0' }}
          />
          <Legend />
          {numericFields.map((field, i) => (
            <Line
              key={field.id}
              type="monotone"
              dataKey={field.label}
              stroke={colors[i % colors.length]}
              activeDot={{ r: 8 }}
              strokeWidth={2}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default CampaignAnalytics;
