# 🌾 Mini Lakehouse Agro

> **Plataforma de Inteligência de Dados para o Agronegócio Brasileiro**  
> Uma arquitetura de Data Lakehouse completa, do dado bruto ao insight analítico, focada na cadeia produtiva da soja e na correlação climática do MATOPIBA.

---

## 📋 Índice

- [Visão Geral](#-visão-geral)
- [Demonstração](#-demonstração)
- [Arquitetura](#-arquitetura)
- [Stack Tecnológico](#-stack-tecnológico)
- [Fontes de Dados](#-fontes-de-dados)
- [Estrutura do Repositório](#-estrutura-do-repositório)
- [Pré-requisitos](#-pré-requisitos)
- [Instalação e Execução](#-instalação-e-execução)
- [Pipelines de Dados (Kestra)](#-pipelines-de-dados-kestra)
- [API REST (FastAPI)](#-api-rest-fastapi)
- [Dashboard (Next.js)](#-dashboard-nextjs)
- [Motor de Correlação Estatística](#-motor-de-correlação-estatística)
- [Segurança e Autenticação](#-segurança-e-autenticação)
- [CI/CD](#-cicd)
- [Testes](#-testes)
- [Decisões de Design](#-decisões-de-design)
- [Contribuindo](#-contribuindo)

---

## 🔭 Visão Geral

O **Mini Lakehouse Agro** é um projeto de portfólio de Engenharia de Dados que demonstra a construção de um pipeline de dados end-to-end para o agronegócio brasileiro. O sistema coleta dados reais de fontes públicas oficiais (IBGE, INPE, IPEAdata, Open-Meteo), processa-os em camadas estruturadas (Bronze → Silver → Gold) e os serve via uma API analítica protegida que alimenta um dashboard interativo com inteligência estatística.

### Por que o MATOPIBA?

O **MATOPIBA** (acrônimo para **MA**ranhão, **TO**cantins, **PI**auí e **BA**hia) é a principal fronteira agrícola do Brasil e uma das regiões de maior crescimento do agronegócio global. Compreender a relação entre o clima regional desta área, a safra nacional de soja e os preços globais (Chicago/B3) é fundamental para analistas, investidores e produtores rurais.

### Hipótese Central

> *"As chuvas no MATOPIBA impactam a Safra Nacional de Soja, que por sua vez define o equilíbrio de oferta e impulsiona ou suprime os preços globais cotados na Bolsa de Chicago (CBOT)."*

Essa mecânica de **causa-e-efeito** — Clima → Safra → Preço — é validada estatisticamente pelo Motor de Correlação de Pearson implementado no backend.

---

## 🖥️ Demonstração

O dashboard roda localmente após a inicialização do ambiente Docker. Acesse em:

| Serviço      | URL                       | Credenciais          |
|:-------------|:--------------------------|:---------------------|
| Dashboard    | http://localhost:3000     | `admin` / `agro123`  |
| API REST     | http://localhost:8000/docs | (Swagger UI)         |
| Kestra UI    | http://localhost:8080     | —                    |
| MinIO Console| http://localhost:9001     | `admin` / `password123` |

---

## 🏗️ Arquitetura

O projeto segue o padrão **Medallion Architecture** (Bronze → Silver → Gold) sobre um objeto de armazenamento compatível com S3, orquestrado por um sistema de workflow e servido por uma API analítica.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          FONTES EXTERNAS                                │
│  IBGE SIDRA │ Open-Meteo │ IPEAdata │ INPE │ yFinance (CBOT)           │
└──────────────────────┬──────────────────────────────────────────────────┘
                       │ (HTTP / REST APIs)
                       ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    ORQUESTRADOR: KESTRA                                 │
│  Namespace: agro.lakehouse                                              │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────────────────────┐   │
│  │  extract_*  │→ │ transform_*  │→ │      build_gold_*            │   │
│  │  (Bronze)   │  │   (Silver)   │  │  (Gold: DuckDB SQL Joins)    │   │
│  └─────────────┘  └──────────────┘  └──────────────────────────────┘   │
└──────────────────────┬──────────────────────────────────────────────────┘
                       │ (Parquet + Apache Iceberg)
                       ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                  ARMAZENAMENTO: MinIO (S3-compatible)                   │
│  Buckets: bronze/ │ silver/ │ gold/                                     │
│  Formato: .parquet (Parquet) + Apache Iceberg (ACID, schema evolution)  │
└──────────────────────┬──────────────────────────────────────────────────┘
                       │ (DuckDB query engine)
                       ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    BACKEND: FastAPI + DuckDB + PyIceberg                │
│  Endpoints: /auth │ /matopiba │ /clima │ /mercado │ /master │ /insights │
│  Auth: JWT Bearer Token                                                 │
│  Analytics: Correlação de Pearson (pandas)                              │
└──────────────────────┬──────────────────────────────────────────────────┘
                       │ (HTTP REST API)
                       ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                     FRONTEND: Next.js 16 + Recharts                    │
│  Dashboard Brutalista │ Motor de Correlação │ 5 abas de análise         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Fluxo de Dados Detalhado

```
Kestra Flow:  extract_* → (salva Parquet/Iceberg) → transform_* → (silver/) → build_gold_* → (gold/)
Backend:      FastAPI lê gold/ via DuckDB + Iceberg → serve JSON → Frontend renderiza
```

---

## 🛠️ Stack Tecnológico

### Infraestrutura
| Tecnologia | Versão | Papel |
|:-----------|:-------|:------|
| **Docker Compose** | v2 | Orquestração de containers |
| **MinIO** | latest | Object Storage (S3-compatible) |
| **PostgreSQL** | 15 | Metastore do Kestra + catálogo Iceberg |
| **Kestra** | latest-full | Orquestração de pipelines de dados |

### Backend
| Tecnologia | Versão | Papel |
|:-----------|:-------|:------|
| **Python** | 3.11 | Runtime principal |
| **FastAPI** | latest | Framework REST API |
| **Uvicorn** | latest | ASGI server |
| **DuckDB** | latest | Engine analítica in-process |
| **PyIceberg** | latest | Leitura/escrita em tabelas Apache Iceberg |
| **pandas** | latest | Análise estatística (Correlação de Pearson) |
| **yfinance** | latest | Dados de mercado (CBOT/B3) |
| **PyJWT** | latest | Geração e validação de tokens JWT |
| **pyarrow** | latest | Bridge Python ↔ Arrow ↔ Parquet |
| **psycopg2-binary** | latest | Adaptador PostgreSQL (catálogo Iceberg) |

### Frontend
| Tecnologia | Versão | Papel |
|:-----------|:-------|:------|
| **Next.js** | 16.2.9 | Framework React SSR |
| **React** | 19.2.4 | UI library |
| **TypeScript** | 5.x | Tipagem estática |
| **Recharts** | 3.8.x | Visualização de dados |
| **Tailwind CSS** | 4.x | Estilização utilitária |

### Qualidade e CI/CD
| Tecnologia | Papel |
|:-----------|:------|
| **pytest** | Testes unitários da API |
| **Great Expectations** | Validação de schema (Data Quality gate) |
| **GitHub Actions** | Pipeline CI/CD automatizado |

---

## 📡 Fontes de Dados

Todos os dados são **reais e de fontes públicas oficiais**. Nenhum dado do dashboard é fictício ou mockado.

### 1. IBGE SIDRA — Produção Agrícola
- **Tabela**: `1612` (Produção de soja por estado)
- **URL**: `https://apisidra.ibge.gov.br/values/t/1612/...`
- **Variáveis**: `109` (Área colhida em ha), `214` (Quantidade produzida em ton)
- **Cobertura**: Nível Nacional e por Estado (n3/all)
- **Atualização**: Anual

### 2. Open-Meteo — Dados Climáticos Históricos (MATOPIBA)
- **API**: `https://archive-api.open-meteo.com/v1/archive`
- **Granularidade**: Dados diários dos últimos 10 anos
- **Cidades coletadas** (média regional do MATOPIBA):
  | Cidade | Estado | Lat | Lon |
  |:-------|:-------|:----|:----|
  | Barreiras | BA | -12.15 | -44.99 |
  | Balsas | MA | -7.53 | -46.03 |
  | Uruçuí | PI | -7.22 | -44.55 |
  | Mateiros | TO | -10.54 | -46.42 |
- **Variáveis**: `precipitation_sum` (mm/dia), `temperature_2m_max`, `temperature_2m_min`
- **O que é mm de chuva?** 1mm = 1 litro de água caindo sobre 1 metro quadrado de solo.

### 3. yFinance / CBOT — Mercado Futuro de Soja
- **Ticker**: `ZS=F` (Contrato futuro de soja na Bolsa de Chicago)
- **Biblioteca**: `yfinance`
- **Período**: Últimos 10 anos
- **Campos**: Data do pregão, Preço de fechamento (US$/bushel)

### 4. IPEAdata — Câmbio USD/BRL
- **API**: IPEAdata REST
- **Série**: Taxa de câmbio comercial BRL/USD histórica
- **Uso**: Contexto macroeconômico para análise de rentabilidade do setor

### 5. INPE — Focos de Calor (Queimadas)
- **API**: INPE BDQueimadas
- **Dados**: Focos de calor anuais por estado/região
- **Uso**: Indicador ambiental na camada Gold

---

## 📁 Estrutura do Repositório

```
mini-lakehouse-agro/
│
├── 📄 main.py                        # API FastAPI principal (backend)
├── 📄 requirements.txt               # Dependências Python
├── 📄 Dockerfile.backend             # Docker do backend Python
├── 📄 docker-compose.yml             # Orquestração de todos os serviços
│
├── 📂 utils/
│   └── auth.py                       # JWT: criação e verificação de tokens
│
├── 📂 tests/
│   └── test_api.py                   # Testes unitários da API (pytest)
│
├── 📂 agro-dashboard/                # Frontend Next.js
│   ├── 📄 package.json
│   ├── 📄 Dockerfile
│   └── 📂 app/
│       ├── page.tsx                  # Página principal / Dashboard
│       ├── layout.tsx                # Layout raiz
│       └── 📂 components/
│           ├── ChartMaster.tsx       # Motor de Correlação (gráfico principal)
│           ├── ChartMatopiba.tsx     # Produção por estado do MATOPIBA
│           ├── ChartCreditoVBP.tsx   # Crédito Rural vs VBP Nacional
│           ├── ChartClima.tsx        # Precipitação e Temperatura MATOPIBA
│           ├── ChartMercado.tsx      # Mercado Futuro vs Safra (B3/CBOT)
│           └── TooltipBox.tsx        # Componente de tooltip educativo
│
├── 📂 kestra/
│   └── 📂 flows/                     # Pipelines do orquestrador Kestra
│       │
│       ├── # ── CAMADA BRONZE (Extração) ──
│       ├── agro.lakehouse.extract_ibge_sidra_soybean.yml
│       ├── agro.lakehouse.extract_inmet_weather.yml
│       ├── agro.lakehouse.extract_conab_b3.yml
│       ├── agro.lakehouse.extract_ipeadata_dollar_exchange.yml
│       ├── agro.lakehouse.extract_inpe_fire_hotspots.yml
│       │
│       ├── # ── CAMADA SILVER (Transformação) ──
│       ├── agro.lakehouse.transform_ibge_to_silver.yml
│       ├── agro.lakehouse.transform_inmet_to_silver.yml
│       ├── agro.lakehouse.transform_conab_b3_to_silver.yml
│       ├── agro.lakehouse.transform_ipeadata_to_silver.yml
│       ├── agro.lakehouse.transform_inpe_to_silver.yml
│       │
│       ├── # ── CAMADA GOLD (Análise) ──
│       ├── agro.lakehouse.build_gold_layer_joined.yml
│       ├── agro.lakehouse.build_gold_conab_b3.yml
│       ├── agro.lakehouse.build_gold_inmet.yml
│       ├── agro.lakehouse.build_gold_matopiba.yml
│       ├── agro.lakehouse.build_gold_credito_vbp.yml
│       │
│       └── # ── PIPELINES COMPOSTOS ──
│           ├── agro.lakehouse.pipeline_matopiba_regional.yml
│           └── agro.lakehouse.pipeline_credito_rural.yml
│
└── 📂 .github/
    └── 📂 workflows/
        └── deploy.yml               # Pipeline CI/CD (GitHub Actions)
```

---

## ✅ Pré-requisitos

Antes de começar, garanta que você possui:

- **Docker Engine** ≥ 24.x
- **Docker Compose** ≥ 2.x
- **Git**
- Acesso à internet (para que os containers baixem imagens e pipelines acessem as APIs públicas)

> **Nota:** Node.js não é necessário para executar o projeto. O frontend Next.js é servido dentro do container Docker.

---

## 🚀 Instalação e Execução

### 1. Clone o repositório

```bash
git clone https://github.com/seu-usuario/mini-lakehouse-agro.git
cd mini-lakehouse-agro
```

### 2. Suba o ambiente completo

```bash
docker compose up -d --build
```

Isso irá subir **5 containers** em sequência:
1. `lakehouse-postgres` — Banco de dados do Kestra e catálogo do Iceberg
2. `lakehouse-minio` — Object Storage (equivalente ao S3)
3. `lakehouse-kestra` — Orquestrador de dados (aguarda o Postgres estar saudável)
4. `lakehouse-backend` — API FastAPI com DuckDB
5. `lakehouse-frontend` — Dashboard Next.js

### 3. Configure os buckets do MinIO

Acesse o MinIO Console em **http://localhost:9001** (`admin` / `password123`) e crie os buckets:
- `bronze`
- `silver`
- `gold`

### 4. Importe os fluxos do Kestra

```bash
# Importa todos os flows de uma vez
for flow in kestra/flows/*.yml; do
  curl -X PUT -H 'Content-Type: application/x-yaml' \
    --data-binary @"$flow" \
    http://localhost:8080/api/v1/flows/agro.lakehouse/$(basename $flow .yml | sed 's/agro.lakehouse.//')
done
```

### 5. Execute os pipelines de extração

No painel do Kestra (**http://localhost:8080**), execute os fluxos na seguinte ordem:

```
1. extract_ibge_sidra_soybean     → gera silver/ → build_gold_layer_joined
2. extract_inmet_weather           → gera silver/ → build_gold_inmet
3. extract_conab_b3               → gera silver/ → build_gold_conab_b3
4. extract_ipeadata_dollar_exchange → gera silver/
5. extract_inpe_fire_hotspots     → gera silver/
6. pipeline_matopiba_regional     → gera gold/matopiba_consolidado_*.parquet
7. pipeline_credito_rural         → gera gold/credito_vbp_consolidado_*.parquet
```

**Ou dispare tudo via API** após o login no dashboard clicando no botão **"Sincronizar Dados"**.

### 6. Acesse o Dashboard

```
http://localhost:3000
Usuário: admin
Senha:   agro123
```

---

## 🔄 Pipelines de Dados (Kestra)

Todos os pipelines rodam como **scripts Python dentro de containers Docker efêmeros**, orquestrados pelo Kestra. O namespace utilizado é `agro.lakehouse`.

### Camada Bronze — Extração Bruta

| Flow | Fonte | Formato de saída | Descrição |
|:-----|:------|:-----------------|:----------|
| `extract_ibge_sidra_soybean` | IBGE SIDRA API | `.json` → MinIO `bronze/` | Produção de soja por estado (todos os anos) |
| `extract_inmet_weather` | Open-Meteo Archive | `.parquet` → MinIO `bronze/` | Média climática diária das 4 cidades do MATOPIBA |
| `extract_conab_b3` | yFinance + IBGE | **Apache Iceberg** → MinIO `bronze/` | Cotações futuras CBOT + Safra Nacional |
| `extract_ipeadata_dollar_exchange` | IPEAdata API | `.parquet` → MinIO `bronze/` | Histórico de câmbio BRL/USD |
| `extract_inpe_fire_hotspots` | INPE API | `.json` → MinIO `bronze/` | Focos de calor anuais |

> **Destaque técnico:** O pipeline `extract_conab_b3` usa **carga incremental com Apache Iceberg**. Ao encontrar uma tabela existente, ele determina a data mais recente e só carrega registros novos, evitando reprocessamento completo.

### Camada Silver — Transformação

Cada flow Silver lê os arquivos brutos do bucket `bronze/`, aplica limpezas, tipagens e normalizações, e salva Parquet estruturado em `silver/`.

**Transformações típicas:**
- Remoção de registros nulos (`dropna`)
- Conversão de tipos (`pd.to_numeric`, `pd.to_datetime`)
- Padronização de nomes de colunas
- Conversão de unidades (ton → milhares de ton, por exemplo)
- Filtragem de anos relevantes

### Camada Gold — Análise e Join

Os flows Gold executam **JOINs analíticos** via DuckDB diretamente nos arquivos Silver do MinIO, gerando tabelas prontas para consumo pelo backend.

#### `build_gold_layer_joined` — Tabela Mestre
Executa um **JOIN TRIPLO** entre IBGE, IPEAdata e INPE:
```sql
WITH ibge_agregado AS (
    SELECT ano, SUM(area_hectares), SUM(producao_toneladas)
    FROM read_parquet('s3://silver/ibge_sidra_soja_*.parquet') GROUP BY ano
),
ipea_agregado AS (...),
inpe_agregado AS (...)
SELECT ibge.ano, area, producao, cotacao_dolar, focos_calor
FROM ibge_agregado ibge
LEFT JOIN ipea_agregado ipea ON ibge.ano = ipea.ano
LEFT JOIN inpe_agregado inpe ON ibge.ano = inpe.ano
```

#### `build_gold_conab_b3` — Tabela de Mercado (Iceberg)
Agrega os dados de cotações diárias do Iceberg em médias mensais:
```sql
SELECT ano, mes,
    AVG(preco_fechamento_usd) as media_preco_usd,
    MAX(estimativa_safra_toneladas) as estimativa_safra
FROM mercado_iceberg
GROUP BY ano, mes
```
O resultado é salvo em uma **tabela Apache Iceberg** na camada Gold (`agro_gold.conab_b3_mercado`).

---

## 🔌 API REST (FastAPI)

A API serve dados analíticos da camada Gold via DuckDB (leitura direta de Parquet) e PyIceberg (leitura de tabelas Iceberg).

### Autenticação

Todos os endpoints analíticos requerem um **Bearer Token JWT**.

```bash
# 1. Obter o token
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "agro123"}'

# Resposta:
# {"access_token": "eyJhbGci...", "token_type": "bearer"}

# 2. Usar o token nos demais endpoints
curl http://localhost:8000/api/v1/indicadores/master \
  -H "Authorization: Bearer eyJhbGci..."
```

### Endpoints

| Método | Endpoint | Auth | Descrição |
|:-------|:---------|:----:|:----------|
| `GET` | `/` | ❌ | Health check da API |
| `POST` | `/api/v1/auth/login` | ❌ | Gera JWT de acesso |
| `GET` | `/api/v1/indicadores/master` | ✅ | Tabela consolidada: Safra + Preço + Clima por ano |
| `GET` | `/api/v1/indicadores/insights` | ✅ | Insight textual gerado pelo Motor de Correlação |
| `GET` | `/api/v1/indicadores/matopiba` | ✅ | Produção por estado do MATOPIBA (IBGE) |
| `GET` | `/api/v1/indicadores/credito-vbp` | ✅ | Crédito Rural vs VBP Nacional |
| `GET` | `/api/v1/indicadores/clima` | ✅ | Série histórica climática do MATOPIBA |
| `GET` | `/api/v1/indicadores/mercado` | ✅ | Cotações CBOT mensais vs Estimativa de Safra |
| `POST` | `/api/v1/sync` | ✅ | Dispara re-execução de todos os flows do Kestra |

### Cache

Todos os endpoints analíticos utilizam `@lru_cache(maxsize=1)` para evitar consultas repetidas ao MinIO/Iceberg. O cache é **invalidado automaticamente** quando o endpoint `/sync` é chamado.

### Documentação Interativa

Acesse o Swagger UI gerado automaticamente pelo FastAPI em:
```
http://localhost:8000/docs
```

---

## 📊 Dashboard (Next.js)

O frontend foi construído com estética **Brutalista** (alto contraste, bordas sólidas pretas, tipografia pesada, paleta monocromática com acento em `#ccff00` verde limão).

### Abas do Dashboard

#### 1. Motor de Correlação (`/master`)
O gráfico central e mais complexo. Combina 3 séries em um único `ComposedChart`:
- **Barras azuis** — Precipitação total anual (mm) no MATOPIBA
- **Linha preta** — Safra Nacional (milhões de toneladas, IBGE)
- **Linha laranja** — Preço Global da Soja (US$/bushel, CBOT Chicago)

Ao lado direito (30% da tela), o **Painel de Insight** exibe em texto maiúsculo o resultado do Motor de Correlação.

#### 2. Safra Matopiba
Gráfico de linhas multi-série mostrando a evolução do **Valor da Produção (R$)** nos 4 estados:
- Bahia (amarelo)
- Maranhão (vermelho)
- Piauí (azul)
- Tocantins (verde)

Os valores são formatados automaticamente em Bilhões (B) e Milhões (M) de Reais.

#### 3. Crédito Rural vs VBP
Série histórica comparativa entre:
- **Crédito Rural**: financiamentos disponibilizados ao setor agropecuário nacional
- **VBP (Valor Bruto de Produção)**: faturamento total das lavouras brasileiras

#### 4. Clima Detalhado MATOPIBA
`ComposedChart` com dois eixos Y:
- **Barras azuis** (eixo esquerdo) — Precipitação diária em mm
- **Linha vermelha** (eixo direito) — Temperatura média (°C)

Dados reais das 4 cidades do MATOPIBA, agregados como média regional diária (Open-Meteo).

#### 5. Mercado B3
Correlaciona a **cotação média mensal do bushel de soja** (CBOT, em US$) com a **estimativa de safra anual** (IBGE, em milhões de toneladas), permitindo visualizar a lei de oferta/demanda em ação.

### Componente `TooltipBox`

Cada aba possui um ícone `?` (fundo verde limão, borda preta) ao lado do título. Ao passar o mouse, exibe uma explicação educativa sobre os dados daquela aba, incluindo:
- O que cada métrica significa
- De onde vem o dado
- Qual o escopo geográfico (Brasil inteiro vs MATOPIBA regional)

---

## 🧠 Motor de Correlação Estatística

O endpoint `/api/v1/indicadores/insights` executa uma análise de **Correlação de Pearson** sobre toda a série histórica disponível.

### Como funciona

```python
import pandas as pd

# Carrega todos os dados válidos da tabela master
df = pd.DataFrame(dados_validos)

# Calcula a matriz de correlação de Pearson
corr = df.corr()

# Extrai os coeficientes relevantes
corr_clima_safra = corr.loc['precipitacao_total', 'safra_toneladas']
corr_safra_preco = corr.loc['safra_toneladas', 'preco_soja']
```

### Interpretação dos coeficientes

| Faixa do coeficiente (r) | Intensidade | Direção |
|:-------------------------|:------------|:--------|
| `r > 0.6` | **Forte** | Positiva |
| `0.3 < r ≤ 0.6` | **Moderada** | Positiva |
| `r ≤ 0.3` | **Fraca** | Positiva |
| `r < -0.6` | **Forte** | Negativa |
| `-0.6 ≤ r < -0.3` | **Moderada** | Negativa |
| `-0.3 ≤ r < 0` | **Fraca** | Negativa |

### Exemplo de output

```
"A SÉRIE HISTÓRICA MOSTRA UMA CORRELAÇÃO ESTATÍSTICA MODERADA POSITIVA (44.3%)
ENTRE AS CHUVAS NO MATOPIBA E A SAFRA NACIONAL. A RELAÇÃO ENTRE A OFERTA DE
SAFRA E O PREÇO GLOBAL EM CHICAGO É MODERADA POSITIVA (40.9%), VALIDANDO A
MECÂNICA DE CAUSA E EFEITO DO AGRONEGÓCIO."
```

> **Nota técnica:** O mínimo de 3 pontos de dados completos (ano + chuva + safra + preço) é necessário para o cálculo estatístico. Se os dados forem insuficientes, o endpoint retorna uma mensagem indicativa.

---

## 🔐 Segurança e Autenticação

### Implementação JWT

```python
# utils/auth.py
SECRET_KEY = "my_super_secret_key_for_portfolio"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60
```

- **Algoritmo**: HS256 (HMAC SHA-256)
- **Expiração**: 60 minutos por token
- **Validação**: Todos os endpoints analíticos usam `Depends(verify_token)` como dependency injection do FastAPI

> ⚠️ **Aviso de Portfólio:** A `SECRET_KEY` está hardcoded por ser um projeto de demonstração. Em ambiente produtivo, **sempre use variáveis de ambiente** ou um secret manager (AWS Secrets Manager, Vault, etc.).

### CORS

O backend está configurado com CORS aberto (`allow_origins=["*"]`) para facilitar o desenvolvimento local. Em produção, restrinja ao domínio específico do frontend.

---

## ⚙️ CI/CD

O pipeline de **GitHub Actions** (`.github/workflows/deploy.yml`) executa automaticamente em todo push e pull request para a branch `main`.

### Estágios

```yaml
jobs:
  test-and-validate:
    steps:
      - Setup Python 3.11
      - Install dependencies (fastapi, httpx, pytest, great_expectations, pandas)
      - Run Schema Tests (Great Expectations)  # Data Quality Gate
      - Run API Unit Tests (pytest)
```

### Data Quality Gate (Great Expectations)

Valida o schema esperado da tabela Gold antes dos testes da API:

```python
gdf = ge.from_pandas(df)
assert gdf.expect_column_values_to_not_be_null('ano').success
assert gdf.expect_column_values_to_not_be_null('safra_toneladas').success
assert gdf.expect_column_values_to_be_between('preco_soja', min_value=0, max_value=10000).success
```

Este gate garante que nenhuma alteração no schema das tabelas passe despercebida.

---

## 🧪 Testes

Os testes unitários usam `pytest` + `TestClient` do FastAPI (sem necessidade de servidor rodando).

```bash
# Executar os testes localmente
pip install -r requirements.txt fastapi httpx pytest
pytest tests/ -v
```

### Casos de teste implementados

| Teste | Endpoint | Esperado |
|:------|:---------|:---------|
| `test_read_root` | `GET /` | 200 + campo `status` |
| `test_login_invalid` | `POST /api/v1/auth/login` | 401 com credenciais erradas |
| `test_login_valid` | `POST /api/v1/auth/login` | 200 + `access_token` |

---

## 💡 Decisões de Design

### Por que DuckDB ao invés de Spark?

Para um projeto de portfólio com datasets na ordem de GBs, **DuckDB é mais eficiente** do que Spark:
- Sem cluster overhead
- Roda in-process (sem servidor separado)
- Suporta leitura direta de Parquet no S3 via extensão `httpfs`
- Performance comparável ao Spark para volumes menores

### Por que Apache Iceberg para o fluxo de Mercado?

O dataset de cotações CBOT é **incremental por natureza** — novos pregões são adicionados diariamente. O Apache Iceberg oferece:
- **ACID transactions**: garantia de consistência em escritas concorrentes
- **Schema evolution**: alteração de colunas sem recriar a tabela
- **Time travel**: consulta de versões históricas dos dados
- **Carga incremental nativa**: o fluxo `extract_conab_b3` só carrega registros mais recentes que a maior data existente na tabela

### Por que Kestra ao invés de Airflow?

- Interface visual mais moderna e intuitiva
- Suporte nativo a scripts Python em containers Docker efêmeros
- Configuração via YAML declarativo (sem Python extra para DAGs)
- Community edition gratuita e self-hosted

### Estética Brutalista no Frontend

A escolha do design brutalista não é arbitrária — é uma declaração de intenção sobre clareza e funcionalidade sobre ornamentação. O dashboard prioriza a **legibilidade dos dados** acima de qualquer efeito visual, usando bordas explícitas, cores fortes e tipografia pesada para guiar a atenção do usuário ao que importa: os dados.

---

## 🤝 Contribuindo

1. Faça um fork do repositório
2. Crie uma branch para sua feature: `git checkout -b feature/minha-feature`
3. Commit seguindo a convenção: `git commit -m "feat(scope): descrição"`
4. Push para a branch: `git push origin feature/minha-feature`
5. Abra um Pull Request

### Convenção de Commits

Este projeto segue o padrão **Conventional Commits**:

| Prefixo | Uso |
|:--------|:----|
| `feat` | Nova funcionalidade |
| `fix` | Correção de bug |
| `chore` | Mudanças de configuração, dependências |
| `docs` | Documentação |
| `refactor` | Refatoração sem mudança de comportamento |
| `test` | Adição ou modificação de testes |

---

## 📄 Licença

Este projeto é de código aberto e disponibilizado para fins educacionais e de portfólio.

---

<div align="center">

**Feito com curiosidade e dados reais do agronegócio brasileiro**

</div>
