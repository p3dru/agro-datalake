"use client";

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
} from "recharts";

interface AgroData {
    ano: number;
    cotacao_media_dolar: number;
    total_producao_toneladas: number;
}

export default function ChartAgro({ data }: { data: AgroData[] }) {
    // Filtramos os anos recentes para manter o gráfico limpo
    const chartData = [...data]
        .filter(item => item.ano >= 2000)
        .reverse();

    return (
        <div className="h-96 w-full mt-8">
            <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />

                    <XAxis dataKey="ano" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />

                    {/* Eixo Y da Esquerda: Produção (Convertendo Toneladas para Bilhões de KG para caber na tela) */}
                    <YAxis
                        yAxisId="left"
                        stroke="#888888"
                        fontSize={12}
                        tickFormatter={(value) => {
                            const valorEmKg = value * 1000;
                            return `${(valorEmKg / 1000000000).toFixed(0)}B Kg`;
                        }}
                    />

                    {/* Eixo Y da Direita: Preço do Dólar */}
                    <YAxis
                        yAxisId="right"
                        orientation="right"
                        stroke="#888888"
                        fontSize={12}
                        tickFormatter={(value) => `R$ ${value}`}
                    />

                    <Tooltip
                        formatter={(value: number, name: string) => {
                            if (name === "cotacao_media_dolar") {
                                return [`R$ ${Number(value).toFixed(2)}`, "Dólar Comercial (Média Anual)"];
                            }
                            if (name === "total_producao_toneladas") {
                                // Converte Toneladas para KG e formata com pontos (ex: 120.000.000.000 Kg)
                                const valorEmKg = value * 1000;
                                return [`${valorEmKg.toLocaleString('pt-BR')} Kg`, "Soja em Grãos (Produção)"];
                            }
                            return [value, name];
                        }}
                        labelFormatter={(label) => `Safra / Ano: ${label}`}
                    />
                    <Legend />

                    <Bar
                        yAxisId="left"
                        dataKey="total_producao_toneladas"
                        name="Soja em Grãos (Kg)"
                        fill="#10b981"
                        radius={[4, 4, 0, 0]}
                    />
                    <Line
                        yAxisId="right"
                        type="monotone"
                        dataKey="cotacao_media_dolar"
                        name="Cotação do Dólar (R$)"
                        stroke="#3b82f6"
                        strokeWidth={3}
                        dot={false}
                    />
                </ComposedChart>
            </ResponsiveContainer>
        </div>
    );
}