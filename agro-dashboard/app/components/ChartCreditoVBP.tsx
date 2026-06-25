"use client";

import React from 'react';
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

interface CreditoVBPRow {
    ano: number;
    credito_concedido_milhoes: number;
    vbp_total_milhoes: number;
}

export default function ChartCreditoVBP({ data }: { data: CreditoVBPRow[] }) {
    const formatMillions = (value: number) => `R$ ${(value / 1000).toFixed(1)}B`;
    return (
        <div className="flex flex-col w-full h-full">
            <p className="text-sm font-medium mb-2 text-gray-700 bg-gray-100 p-2 border-l-4 border-black">
                <strong>Escopo Nacional:</strong> Compara o volume total de Crédito Rural concedido a empresas no Brasil (via BCB) contra o Valor Bruto da Produção retornado.
            </p>
            <div className="h-[360px] w-full mt-2">
            <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={data} margin={{ top: 20, right: 30, bottom: 20, left: 30 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="ano" stroke="#888888" fontSize={12} />

                    {/* Eixo Y Esquerdo (Barras - Crédito) */}
                    <YAxis
                        yAxisId="left"
                        orientation="left"
                        stroke="#10b981"
                        fontSize={12}
                        tickFormatter={formatMillions}
                    />
                    {/* Eixo Y Direito (Linha - VBP) */}
                    <YAxis
                        yAxisId="right"
                        orientation="right"
                        stroke="#3b82f6"
                        fontSize={12}
                        tickFormatter={formatMillions}
                    />

                    <Tooltip
                        formatter={(value: any) => `R$ ${Number(value).toLocaleString('pt-BR')} Milhões`}
                        labelFormatter={(label) => `Ano: ${label}`}
                    />
                    <Legend />

                    <Bar
                        yAxisId="left"
                        dataKey="credito_concedido_milhoes"
                        name="Crédito Rural (Concedido)"
                        fill="#10b981"
                        opacity={0.8}
                        radius={[4, 4, 0, 0]}
                    />
                    <Line
                        yAxisId="right"
                        type="monotone"
                        dataKey="vbp_total_milhoes"
                        name="VBP (Retorno)"
                        stroke="#3b82f6"
                        strokeWidth={4}
                        dot={{ r: 4 }}
                    />
                </ComposedChart>
            </ResponsiveContainer>
            </div>
        </div>
    );
}