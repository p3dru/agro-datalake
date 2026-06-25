"use client";

import React, { useEffect, useState } from 'react';
import {
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';

interface MasterData {
  ano: number;
  preco_soja: number;
  safra_toneladas: number;
  precipitacao_total: number;
  temperatura_media: number;
}

export default function ChartMaster({ token }: { token: string }) {
  const [data, setData] = useState<MasterData[]>([]);
  const [insight, setInsight] = useState<string>("Carregando insights...");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;

    const headers = { 'Authorization': `Bearer ${token}` };

    Promise.all([
      fetch('http://localhost:8000/api/v1/indicadores/master', { headers }).then(res => res.json()),
      fetch('http://localhost:8000/api/v1/indicadores/insights', { headers }).then(res => res.json())
    ]).then(([masterJson, insightJson]) => {
      setData(masterJson.data || []);
      setInsight(insightJson.insight || "Erro ao carregar insights.");
      setLoading(false);
    }).catch(err => {
      console.error("Erro Master/Insights:", err);
      setLoading(false);
    });
  }, [token]);

  if (loading) return <div className="h-96 flex items-center justify-center font-mono uppercase font-bold text-gray-500">Iniciando Motor de Correlação...</div>;

  return (
    <div className="flex flex-col lg:flex-row gap-0 border-4 border-black bg-white shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] mb-12">
      {/* 70% Chart Area */}
      <div className="w-full lg:w-[70%] p-6 border-b-4 lg:border-b-0 lg:border-r-4 border-black">
        <h2 className="text-2xl font-black uppercase mb-2 tracking-tighter text-black">Mecânica: Causa e Efeito</h2>
        <p className="text-sm font-medium mb-6 text-gray-700 bg-gray-100 p-2 border-l-4 border-black">
          <strong>O que este gráfico mostra:</strong> Como o <strong>Clima Regional</strong> (volume de chuva no MATOPIBA) afeta a <strong>Safra Nacional</strong> (produção total do Brasil), que por sua vez impacta o <strong>Preço Global</strong> (cotação do bushel de soja em Chicago/B3).
        </p>
        <div className="h-[450px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
              <XAxis dataKey="ano" stroke="#000" tick={{fill: '#000', fontWeight: 'bold'}} />
              
              <YAxis yAxisId="preco" orientation="left" stroke="#ff4500" tick={{fill: '#ff4500', fontWeight: 'bold'}} />
              <YAxis yAxisId="chuva" orientation="right" stroke="#0000ff" tick={{fill: '#0000ff', fontWeight: 'bold'}} />
              <YAxis yAxisId="safra" orientation="right" stroke="#000" hide />
              
              <Tooltip 
                contentStyle={{ borderRadius: '0px', border: '4px solid black', fontWeight: 'bold', textTransform: 'uppercase', boxShadow: '4px 4px 0px 0px rgba(0,0,0,1)' }}
                formatter={(value: any, name: any) => {
                  if (name === "Preço Soja (US$)") return [`US$ ${Number(value).toFixed(2)}`, name];
                  if (name === "Chuva (mm)") return [`${Number(value).toFixed(0)} mm`, name];
                  if (name === "Safra (Ton)") return [`${(Number(value)/1000000).toFixed(1)} Milhões`, name];
                  return [value, name];
                }}
              />
              <Legend wrapperStyle={{fontWeight: 'bold', marginTop: '10px'}} />
              
              <Bar yAxisId="chuva" dataKey="precipitacao_total" name="Chuva (mm)" fill="#0000ff" />
              <Line yAxisId="safra" type="step" dataKey="safra_toneladas" name="Safra (Ton)" stroke="#000" strokeWidth={4} dot={{ r: 4, strokeWidth: 4 }} />
              <Line yAxisId="preco" type="monotone" dataKey="preco_soja" name="Preço Soja (US$)" stroke="#ff4500" strokeWidth={5} dot={{ r: 6, fill: '#ff4500', strokeWidth: 2, stroke: '#000' }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
      
      {/* 30% Typographic Brutalism Insight */}
      <div className="w-full lg:w-[30%] bg-[#ccff00] p-8 flex flex-col justify-center">
        <h3 className="text-xl font-bold uppercase mb-4 border-b-4 border-black pb-2 text-black">Insight Analítico</h3>
        <p className="text-3xl lg:text-4xl font-black leading-[1.0] tracking-tighter uppercase text-black break-words mt-4">
          {insight}
        </p>
        <div className="mt-8 pt-4 border-t-4 border-black">
          <p className="font-mono text-sm font-bold uppercase text-black">
            Motor de Correlação dinâmico ativado.
          </p>
        </div>
      </div>
    </div>
  );
}
