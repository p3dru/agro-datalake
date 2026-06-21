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
  Legend,
  ResponsiveContainer,
  Area
} from 'recharts';

// Interface atualizada com a nova métrica
interface AgroData {
  ano: number;
  total_area_hectares: number;
  total_producao_toneladas: number;
  cotacao_media_dolar: number;
  total_focos_calor: number;
}

export default function Dashboard() {
  const [data, setData] = useState<AgroData[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeMetrics, setActiveMetrics] = useState({
    producao: true,
    dolar: true,
    fogo: true,
  });

  const toggleMetric = (metric: keyof typeof activeMetrics) => {
    setActiveMetrics((prev) => ({
      ...prev,
      [metric]: !prev[metric],
    }));
  };

  useEffect(() => {
    // Apontando para a sua API FastAPI
    fetch('http://localhost:8000/api/v1/indicadores/anuais')
      .then((response) => response.json())
      .then((jsonData) => {
        // Inverte os dados para o gráfico ir do ano mais antigo ao mais recente
        const records = jsonData.data || jsonData;
        setData([...records].reverse());
        setLoading(false);
      })
      .catch((error) => {
        console.error("Erro ao buscar dados da API:", error);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <p className="text-xl font-semibold text-gray-600">Carregando Data Lakehouse...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-6xl">
        <h1 className="mb-2 text-3xl font-bold text-gray-800">
          Inteligência Agrícola: Soja, Câmbio e Clima
        </h1>
        <p className="mb-8 text-gray-600">
          Cruzamento de dados de produção (IBGE), economia (IPEA) e riscos ambientais (INPE).
        </p>

        <div className="rounded-xl bg-white p-6 shadow-lg">
          {/* Controles de Filtro */}
          <div className="mb-6 flex flex-wrap gap-4">
            <button
              onClick={() => toggleMetric('producao')}
              className={`rounded-lg px-4 py-2 font-medium transition-all ${
                activeMetrics.producao
                  ? 'bg-emerald-500 text-white shadow-md'
                  : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
              }`}
            >
              <span className="mr-2 inline-block h-3 w-3 rounded-full bg-emerald-300"></span>
              Produção (Ton)
            </button>
            <button
              onClick={() => toggleMetric('fogo')}
              className={`rounded-lg px-4 py-2 font-medium transition-all ${
                activeMetrics.fogo
                  ? 'bg-red-500 text-white shadow-md'
                  : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
              }`}
            >
              <span className="mr-2 inline-block h-3 w-3 rounded-full bg-red-300"></span>
              Focos de Calor
            </button>
            <button
              onClick={() => toggleMetric('dolar')}
              className={`rounded-lg px-4 py-2 font-medium transition-all ${
                activeMetrics.dolar
                  ? 'bg-blue-500 text-white shadow-md'
                  : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
              }`}
            >
              <span className="mr-2 inline-block h-3 w-3 rounded-full bg-blue-300"></span>
              Dólar (R$)
            </button>
          </div>

          <div className="h-[500px] w-full" style={{ minHeight: '500px' }}>
            <ResponsiveContainer width="100%" height="100%" minHeight={500}>
              <ComposedChart
                data={data}
                margin={{ top: 20, right: 40, bottom: 20, left: 60 }}
              >
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="ano" />

                {/* Eixo Y Dinâmico da Esquerda */}
                <YAxis
                  yAxisId="left"
                  domain={['auto', 'auto']}
                  tickFormatter={(value) => {
                    if (activeMetrics.producao) return `${(value / 1000000).toFixed(1)}M`;
                    if (activeMetrics.dolar) return `R$ ${value}`;
                    return value.toLocaleString('pt-BR');
                  }}
                  width={80}
                />

                {/* Eixo Y da Direita exclusivo para Dólar */}
                {activeMetrics.producao && activeMetrics.dolar && (
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    domain={['auto', 'auto']}
                    tickFormatter={(value) => `R$ ${value}`}
                    width={80}
                  />
                )}

                {/* Eixo Invisível para Focos */}
                <YAxis yAxisId="fire" hide={true} domain={['auto', 'auto']} />

                <Tooltip
                  formatter={(value: number, name: string) => {
                    if (name === "Produção (Ton)") return [value.toLocaleString('pt-BR'), name];
                    if (name === "Dólar (R$)") return [`R$ ${value.toFixed(2)}`, name];
                    if (name === "Focos de Calor") return [value.toLocaleString('pt-BR'), name];
                    return value;
                  }}
                />

                {/* Produção da Soja (Barras Verdes) */}
                {activeMetrics.producao && (
                  <Bar
                    yAxisId="left"
                    dataKey="total_producao_toneladas"
                    name="Produção (Ton)"
                    fill="#10b981"
                    radius={[4, 4, 0, 0]}
                  />
                )}

                {/* Focos de Calor (Área Vermelha ao fundo) */}
                {activeMetrics.fogo && (
                  <Area
                    yAxisId={(!activeMetrics.producao && !activeMetrics.dolar) ? "left" : "fire"}
                    type="monotone"
                    dataKey="total_focos_calor"
                    name="Focos de Calor"
                    fill="#ef4444"
                    stroke="#ef4444"
                    fillOpacity={0.2}
                  />
                )}

                {/* Cotação do Dólar (Linha Azul) */}
                {activeMetrics.dolar && (
                  <Line
                    yAxisId={activeMetrics.producao ? "right" : "left"}
                    type="monotone"
                    dataKey="cotacao_media_dolar"
                    name="Dólar (R$)"
                    stroke="#3b82f6"
                    strokeWidth={3}
                    dot={{ r: 4 }}
                  />
                )}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}