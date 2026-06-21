import ChartAgro from "./components/ChartAgro";
import { TrendingUp, Database, Activity } from "lucide-react";

// Função para buscar os dados da nossa API (roda no servidor do Next.js)
async function getIndicadores() {
  // Apontando para o FastAPI rodando localmente
  const res = await fetch("http://127.0.0.1:8000/api/v1/indicadores/anuais", {
    cache: "no-store", // Garante que pegamos dados frescos se o Lakehouse atualizar
  });

  if (!res.ok) {
    throw new Error("Falha ao carregar os dados da camada Gold");
  }

  return res.json();
}

export default async function Home() {
  const payload = await getIndicadores();
  const dados = payload.data;
  const totalLinhas = payload.total_linhas;

  // Pegar o dado mais recente para os "Cards" de resumo
  const dadoMaisRecente = dados[0];

  return (
    <main className="min-h-screen bg-gray-50 p-8 text-gray-900">
      <div className="max-w-6xl mx-auto">

        {/* Cabeçalho */}
        <header className="mb-10">
          <h1 className="text-3xl font-bold">Observatório Agropecuário</h1>
          <p className="text-gray-500">Inteligência de dados baseada em Data Lakehouse (Arquitetura Medalhão)</p>
        </header>

        {/* Cards de KPI */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center space-x-4">
            <div className="p-3 bg-blue-100 text-blue-600 rounded-lg"><Database /></div>
            <div>
              <p className="text-sm text-gray-500">Registros Históricos (Gold)</p>
              <p className="text-2xl font-bold">{totalLinhas} anos</p>
            </div>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center space-x-4">
            <div className="p-3 bg-purple-100 text-purple-600 rounded-lg"><Activity /></div>
            <div>
              <p className="text-sm text-gray-500">Status do Pipeline</p>
              <p className="text-2xl font-bold text-green-500">Ativo</p>
            </div>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center space-x-4">
            <div className="p-3 bg-emerald-100 text-emerald-600 rounded-lg"><TrendingUp /></div>
            <div>
              <p className="text-sm text-gray-500">Dólar Médio ({dadoMaisRecente.ano})</p>
              <p className="text-2xl font-bold">
                R$ {dadoMaisRecente.cotacao_media_dolar
                  ? dadoMaisRecente.cotacao_media_dolar.toFixed(2)
                  : "N/A"}
              </p>
            </div>
          </div>
        </div>

        {/* Gráfico */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h2 className="text-xl font-semibold mb-2">Produção de Soja em Grãos vs. Cotação do Dólar</h2>
          <p className="text-sm text-gray-500">
            Correlação histórica entre o volume de grãos produzidos (em Kg) e a valorização da moeda americana.
          </p>
          <ChartAgro data={dados} />
        </div>

      </div>
    </main>
  );
}