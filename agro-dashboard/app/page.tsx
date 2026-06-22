"use client";

import React, { useEffect, useState } from 'react';
import ChartMaster from './components/ChartMaster';
import ChartMatopiba from './components/ChartMatopiba';
import ChartCreditoVBP from './components/ChartCreditoVBP';
import ChartClima from './components/ChartClima';
import ChartMercado from './components/ChartMercado';

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState('master');
  const [isSyncing, setIsSyncing] = useState(false);

  const [dataMatopiba, setDataMatopiba] = useState([]);
  const [dataCredito, setDataCredito] = useState([]);
  const [dataClima, setDataClima] = useState([]);
  const [dataMercado, setDataMercado] = useState([]);

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      await fetch('http://localhost:8000/api/v1/sync', { method: 'POST' });
      setTimeout(() => setIsSyncing(false), 3000);
    } catch (err) {
      console.error("Erro ao sincronizar:", err);
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    fetch('http://localhost:8000/api/v1/indicadores/matopiba')
      .then((res) => res.json())
      .then((json) => setDataMatopiba(json.data || []))
      .catch((err) => console.error("Erro MATOPIBA:", err));

    fetch('http://localhost:8000/api/v1/indicadores/credito-vbp')
      .then((res) => res.json())
      .then((json) => setDataCredito(json.data || []))
      .catch((err) => console.error("Erro Crédito:", err));

    fetch('http://localhost:8000/api/v1/indicadores/clima')
      .then((res) => res.json())
      .then((json) => setDataClima(json.data || []))
      .catch((err) => console.error("Erro Clima:", err));

    fetch('http://localhost:8000/api/v1/indicadores/mercado')
      .then((res) => res.json())
      .then((json) => setDataMercado(json.data || []))
      .catch((err) => console.error("Erro Mercado:", err));
  }, []);

  const tabs = [
    { id: 'master', label: 'Motor de Correlação' },
    { id: 'matopiba', label: 'Safra Matopiba' },
    { id: 'credito', label: 'Crédito vs VBP' },
    { id: 'clima', label: 'Clima Detalhado' },
    { id: 'mercado', label: 'Mercado B3' }
  ];

  return (
    <div className="min-h-screen bg-gray-50 p-8 font-sans">
      <div className="mx-auto max-w-7xl">
        
        {/* HEADER BRUTALISTA */}
        <div className="mb-12 flex flex-col md:flex-row items-start md:items-end justify-between border-b-8 border-black pb-4">
          <div>
            <h1 className="text-5xl font-black text-black uppercase tracking-tighter leading-none mb-2">
              Agro<br/>Lakehouse
            </h1>
            <p className="text-xl font-bold uppercase text-gray-600 tracking-tight">
              Inteligência de Dados • Soja, Câmbio e Clima
            </p>
          </div>

          <button
            onClick={handleSync}
            disabled={isSyncing}
            className={`mt-6 md:mt-0 flex items-center border-4 border-black px-6 py-3 font-black uppercase transition-all shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] ${
              isSyncing ? 'bg-gray-300 text-gray-500 translate-x-[6px] translate-y-[6px] shadow-none' : 'bg-[#ccff00] text-black hover:bg-[#aacc00] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-x-[6px] active:translate-y-[6px] active:shadow-none'
            }`}
          >
            {isSyncing ? 'Sincronizando...' : 'Sincronizar Dados'}
          </button>
        </div>

        {/* TABS BRUTALISTAS */}
        <div className="flex flex-wrap gap-2 mb-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`border-4 border-black px-6 py-2 font-black uppercase text-sm md:text-base transition-all ${
                activeTab === tab.id 
                  ? 'bg-black text-white shadow-[4px_4px_0px_0px_rgba(204,255,0,1)] translate-x-[2px] translate-y-[2px]' 
                  : 'bg-white text-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:bg-gray-100 hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* CONTEÚDO DAS ABAS */}
        <div className="w-full">
          {activeTab === 'master' && <ChartMaster />}
          
          {activeTab === 'matopiba' && (
            <div className="border-4 border-black bg-white shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-6">
              <h2 className="text-2xl font-black uppercase mb-6 tracking-tighter text-black border-b-4 border-black pb-2">Visão Regional: MATOPIBA</h2>
              <ChartMatopiba data={dataMatopiba} />
            </div>
          )}
          
          {activeTab === 'credito' && (
            <div className="border-4 border-black bg-white shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-6">
              <h2 className="text-2xl font-black uppercase mb-6 tracking-tighter text-black border-b-4 border-black pb-2">Crédito Rural vs VBP</h2>
              <ChartCreditoVBP data={dataCredito} />
            </div>
          )}
          
          {activeTab === 'clima' && (
            <div className="border-4 border-black bg-white shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-6">
              <h2 className="text-2xl font-black uppercase mb-6 tracking-tighter text-black border-b-4 border-black pb-2">Monitoramento Climático INMET</h2>
              <ChartClima data={dataClima} />
            </div>
          )}
          
          {activeTab === 'mercado' && (
            <div className="border-4 border-black bg-white shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-6">
              <h2 className="text-2xl font-black uppercase mb-6 tracking-tighter text-black border-b-4 border-black pb-2">Mercado Futuro vs Safra</h2>
              <ChartMercado data={dataMercado} />
            </div>
          )}
        </div>

      </div>
    </div>
  );
}