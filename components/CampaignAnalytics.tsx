import React from 'react';
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
import { SessionLog, CustomField, FieldType, ResourceValue } from '../types';

interface CampaignAnalyticsProps {
  logs: SessionLog[];
  fields: CustomField[];
}

const CampaignAnalytics: React.FC<CampaignAnalyticsProps> = ({ logs, fields }) => {
  // Find numeric fields to chart (Including RESOURCE types)
  const numericFields = fields.filter(f => f.type === FieldType.NUMBER || f.type === FieldType.RESOURCE);

  if (numericFields.length === 0 || logs.length === 0) {
    return (
      <div className="p-8 text-center text-slate-500 border border-slate-800 rounded-lg bg-slate-900/50">
        <p>Adicione campos numéricos ou de recurso e registre algumas sessões para ver as análises.</p>
      </div>
    );
  }

  // Prepare data for Recharts
  const sortedLogs = [...logs].sort((a, b) => a.timestamp - b.timestamp);
  
  const data = sortedLogs.map((log, index) => {
    const point: any = {
      name: `Sessão ${index + 1}`,
      date: new Date(log.timestamp).toLocaleDateString('pt-BR'),
    };
    
    numericFields.forEach(field => {
        const val = log.data[field.id];
        if (field.type === FieldType.RESOURCE && typeof val === 'object') {
             // For resources, plot the current value
             point[field.label] = (val as ResourceValue).current || 0;
        } else {
             point[field.label] = Number(val) || 0;
        }
    });

    return point;
  });

  const colors = ['#f59e0b', '#8b5cf6', '#ec4899', '#10b981', '#3b82f6'];

  return (
    <div className="w-full h-80 bg-slate-900/50 p-4 rounded-xl border border-slate-800">
      <h3 className="text-lg font-bold text-slate-300 mb-4 cinzel">Evolução dos Recursos</h3>
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