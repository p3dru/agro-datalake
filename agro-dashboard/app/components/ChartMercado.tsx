"use client";

import React, { useMemo } from 'react';
import {
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

interface MercadoRow {
  ano: number;
  mes: number;
  media_preco_usd: number;
  estimativa_safra: number;
}

export default function ChartMercado({ data }: { data: MercadoRow[] }) {
  const chartData = useMemo(() => {
    return data.map(item => ({
      ...item,
      mesAno: `${String(item.mes).padStart(2, '0')}/${item.ano}`,
      media_preco_usd: Number(item.media_preco_usd || 0).toFixed(2),
      // Estimativa pode ser em milhões para não quebrar o eixo
      estimativa_safra_m: Number((item.estimativa_safra || 0) / 1000000).toFixed(1)
    }));
  }, [data]);

  return (
    <div className="h-[400px] w-full mt-4">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={chartData} margin={{ top: 20, right: 30, bottom: 20, left: 30 }}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
          <XAxis dataKey="mesAno" stroke="#888888" fontSize={12} />
          
          <YAxis 
            yAxisId="left"
            stroke="#888888" 
            fontSize={12} 
            tickFormatter={(val) => `US$ ${val}`}
            width={80}
            domain={['dataMin - 100', 'dataMax + 100']}
          />
          
          <YAxis 
            yAxisId="right"
            orientation="right"
            stroke="#888888" 
            fontSize={12} 
            tickFormatter={(val) => `${val}M t`}
            width={80}
          />
          
          <Tooltip 
            formatter={(value: any, name: any) => {
              if (name === "Preço Médio Soja") return [`US$ ${value}`, name];
              if (name === "Estimativa de Safra (CONAB)") return [`${value} Milhões de Toneladas`, name];
              return [value, name];
            }}
          />
          <Legend />

          <Bar 
            yAxisId="right" 
            dataKey="estimativa_safra_m" 
            name="Estimativa de Safra (CONAB)" 
            fill="#10b981" 
            radius={[4, 4, 0, 0]}
            barSize={40}
          />
          <Line 
            yAxisId="left" 
            type="monotone" 
            dataKey="media_preco_usd" 
            name="Preço Médio Soja" 
            stroke="#8b5cf6" 
            strokeWidth={3} 
            dot={false} 
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
