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

interface ClimaRow {
  data_medicao: string;
  regiao: string;
  precipitacao_mm: number;
  temperatura_media: number;
}

export default function ChartClima({ data }: { data: ClimaRow[] }) {
  const chartData = useMemo(() => {
    // Formatando as datas para melhor exibição no eixo X
    return data.map(item => {
      let dataFormatada = item.data_medicao;
      try {
        const d = new Date(item.data_medicao);
        if (!isNaN(d.getTime())) {
          dataFormatada = d.toLocaleDateString('pt-BR');
        }
      } catch(e) {}
      
      return {
        ...item,
        dataFormatada,
        precipitacao_mm: Number(item.precipitacao_mm || 0).toFixed(2),
        temperatura_media: Number(item.temperatura_media || 0).toFixed(1)
      };
    });
  }, [data]);

  return (
    <div className="flex flex-col w-full h-full">
      <p className="text-sm font-medium mb-2 text-gray-700 bg-gray-100 p-2 border-l-4 border-black">
        <strong>Escopo Local:</strong> Histórico real de Precipitação (chuva em mm) na região polo do MATOPIBA (Barreiras-BA), atualizado diariamente via API do Open-Meteo.
      </p>
      <div className="h-[360px] w-full mt-2">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={chartData} margin={{ top: 20, right: 30, bottom: 20, left: 30 }}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
          <XAxis dataKey="dataFormatada" stroke="#888888" fontSize={12} />
          
          <YAxis 
            yAxisId="left"
            stroke="#888888" 
            fontSize={12} 
            tickFormatter={(val) => `${val} mm`}
            width={80}
          />
          <YAxis 
            yAxisId="right"
            orientation="right"
            stroke="#888888" 
            fontSize={12} 
            tickFormatter={(val) => `${val} °C`}
            width={80}
          />
          
          <Tooltip 
            formatter={(value: any, name: any) => {
              if (name === "Precipitação") return [`${value} mm`, name];
              if (name === "Temperatura Média") return [`${value} °C`, name];
              return [value, name];
            }}
          />
          <Legend />

          <Bar 
            yAxisId="left" 
            dataKey="precipitacao_mm" 
            name="Precipitação" 
            fill="#3b82f6" 
            radius={[4, 4, 0, 0]} 
          />
          <Line 
            yAxisId="right" 
            type="monotone" 
            dataKey="temperatura_media" 
            name="Temperatura Média" 
            stroke="#ef4444" 
            strokeWidth={3} 
            dot={false} 
          />
        </ComposedChart>
      </ResponsiveContainer>
      </div>
    </div>
  );
}
