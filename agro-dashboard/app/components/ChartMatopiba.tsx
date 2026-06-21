"use client";

import React, { useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

interface MatopibaRow {
  ano: number;
  estado: string;
  area_colhida_hectares: number;
  valor_producao_reais: number;
}

export default function ChartMatopiba({ data }: { data: MatopibaRow[] }) {
  // Transforma os dados brutos em um formato amigável para o Recharts
  // Ex: { ano: 2020, 'Piauí': 1000000, 'Bahia': 5000000, ... }
  const chartData = useMemo(() => {
    const grouped: Record<number, any> = {};
    
    data.forEach((item) => {
      if (!grouped[item.ano]) {
        grouped[item.ano] = { ano: item.ano };
      }
      // Criamos uma chave com o nome do estado e atribuímos o valor financeiro
      grouped[item.ano][item.estado] = item.valor_producao_reais;
    });

    // Converte de volta para array e ordena cronologicamente, filtrando os zerados antigos
    return Object.values(grouped)
      .filter((row) => row.ano >= 1995) 
      .sort((a, b) => a.ano - b.ano);
  }, [data]);

  // Formatador visual para converter números gigantes em Bilhões/Milhões
  const formatCurrency = (value: number) => {
    if (value >= 1e9) return `R$ ${(value / 1e9).toFixed(1)}B`;
    if (value >= 1e6) return `R$ ${(value / 1e6).toFixed(0)}M`;
    return `R$ ${value}`;
  };

  return (
    <div className="h-[400px] w-full mt-4">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 20, right: 30, bottom: 20, left: 30 }}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
          <XAxis dataKey="ano" stroke="#888888" fontSize={12} />
          
          <YAxis 
            stroke="#888888" 
            fontSize={12} 
            tickFormatter={formatCurrency}
            width={80}
          />
          
          <Tooltip 
            formatter={(value: number, name: string) => [
              `R$ ${value.toLocaleString('pt-BR')}`, 
              name
            ]}
            labelFormatter={(label) => `Ano: ${label}`}
          />
          <Legend />

          <Line type="monotone" dataKey="Bahia" stroke="#eab308" strokeWidth={3} dot={false} />
          <Line type="monotone" dataKey="Maranhão" stroke="#ef4444" strokeWidth={3} dot={false} />
          <Line type="monotone" dataKey="Piauí" stroke="#3b82f6" strokeWidth={4} dot={{ r: 3 }} />
          <Line type="monotone" dataKey="Tocantins" stroke="#10b981" strokeWidth={3} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}