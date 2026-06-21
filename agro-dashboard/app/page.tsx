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
  Area
} from 'recharts';
import ChartMatopiba from './components/ChartMatopiba';
import ChartCreditoVBP from './components/ChartCreditoVBP';

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

  // Adicione este novo estado logo abaixo dos que já existem
  const [dataMatopiba, setDataMatopiba] = useState([]);
  const [dataCredito, setDataCredito] = useState([]);
  const [isSyncing, setIsSyncing] = useState(false);

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      await fetch('http://localhost:8000/api/v1/sync', { method: 'POST' });
      // Mantém o botão em estado de "Sincronizando..." por uns segundos para debouncing visual
      setTimeout(() => setIsSyncing(false), 3000);
    } catch (err) {
      console.error("Erro ao sincronizar:", err);
      setIsSyncing(false);
    }
  };

  // Dentro do useEffect atual (ou num novo), adicione a chamada:
  useEffect(() => {
    // ... sua chamada antiga do macro cenário ...

    // Nova chamada Regional
    fetch('http://localhost:8000/api/v1/indicadores/matopiba')
      .then((res) => res.json())
      .then((json) => setDataMatopiba(json.data || []))
      .catch((err) => console.error("Erro MATOPIBA:", err));

    // Nova chamada Crédito vs VBP
    fetch('http://localhost:8000/api/v1/indicadores/credito-vbp')
      .then((res) => res.json())
      .then((json) => setDataCredito(json.data || []))
      .catch((err) => console.error("Erro Crédito:", err));
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
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="mb-2 text-3xl font-bold text-gray-800">
              Inteligência Agrícola: Soja, Câmbio e Clima
            </h1>
            <p className="text-gray-600">
              Cruzamento de dados de produção (IBGE), economia (IPEA) e riscos ambientais (INPE).
            </p>
          </div>
          
          <button
            onClick={handleSync}
            disabled={isSyncing}
            className={`flex items-center rounded-lg px-6 py-3 font-semibold text-white transition-all shadow-md ${
              isSyncing ? 'bg-gray-400 cursor-not-allowed' : 'bg-purple-600 hover:bg-purple-700'
            }`}
          >
            {isSyncing ? (
              <>
                <svg className="mr-2 h-5 w-5 animate-spin text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                Sincronizando Lakehouse...
              </>
            ) : (
              <>
                <svg className="mr-2 h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
                Sincronizar (Webhook)
              </>
            )}
          </button>
        </div>

        <div className="rounded-xl bg-white p-6 shadow-lg">
          {/* Controles de Filtro */}
          <div className="mb-6 flex flex-wrap gap-4">
            <button
              onClick={() => toggleMetric('producao')}
              className={`rounded-lg px-4 py-2 font-medium transition-all ${activeMetrics.producao
                ? 'bg-emerald-500 text-white shadow-md'
                : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                }`}
            >
              <span className="mr-2 inline-block h-3 w-3 rounded-full bg-emerald-300"></span>
              Produção (Ton)
            </button>
            <button
              onClick={() => toggleMetric('fogo')}
              className={`rounded-lg px-4 py-2 font-medium transition-all ${activeMetrics.fogo
                ? 'bg-red-500 text-white shadow-md'
                : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                }`}
            >
              <span className="mr-2 inline-block h-3 w-3 rounded-full bg-red-300"></span>
              Focos de Calor
            </button>
            <button
              onClick={() => toggleMetric('dolar')}
              className={`rounded-lg px-4 py-2 font-medium transition-all ${activeMetrics.dolar
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
                  formatter={(value: any, name: any) => {
                    const numValue = Number(value);
                    if (name === "Produção (Ton)") return [numValue.toLocaleString('pt-BR'), name];
                    if (name === "Dólar (R$)") return [`R$ ${numValue.toFixed(2)}`, name];
                    if (name === "Focos de Calor") return [numValue.toLocaleString('pt-BR'), name];
                    return numValue;
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

      {/* Nova Seção: Visão Regional MATOPIBA */}
      <div className="rounded-xl bg-white p-6 shadow-lg mt-8">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Visão Regional: O Fenômeno MATOPIBA</h2>
        <p className="text-gray-600 mb-4">
          Evolução do Valor Bruto da Produção (VBP) de soja em grãos na maior fronteira agrícola do país.
        </p>

        <ChartMatopiba data={dataMatopiba} />
      </div>

      {/* Nova Seção: Crédito x Produção */}
      <div className="rounded-xl bg-white p-6 shadow-lg mt-8">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Alavancagem: Crédito Rural vs VBP</h2>
        <p className="text-gray-600 mb-4">
          Relação histórica entre as concessões de crédito e o Valor Bruto de Produção no MATOPIBA.
        </p>
        <ChartCreditoVBP data={dataCredito} />
      </div>
    </div>
  );
}