# 🚧 Diário de Bordo: Problemas e Soluções (Lessons Learned)

> Este documento compila os principais desafios, bugs e bloqueios encontrados durante o desenvolvimento do **Mini Lakehouse Agro**, bem como as soluções arquiteturais e de código aplicadas para resolvê-los. É um material valioso para estudo de casos reais em Engenharia de Dados.

---

## 1. Instabilidade Crônica da API do INMET
**O Problema:** 
A intenção original era coletar dados climáticos do INMET (Instituto Nacional de Meteorologia). No entanto, a API pública do INMET demonstrou extrema instabilidade, retornando erros `500 Internal Server Error`, `502 Bad Gateway`, sofrendo timeouts frequentes e até bloqueando requisições (rate limiting) durante a execução dos pipelines no Kestra.

**A Solução:**
Trocamos a fonte de dados climáticos para a **Open-Meteo Archive API**. 
* **Por que funcionou:** A Open-Meteo é altamente estável, gratuita para uso não-comercial, não exige chave de API e permite consultas precisas por Latitude e Longitude.
* **Ajuste:** Em vez de buscar por códigos de estações meteorológicas falhas, passamos a buscar as coordenadas exatas das 4 principais cidades do MATOPIBA (Barreiras, Balsas, Uruçuí, Mateiros) e agregamos a média regional.

---

## 2. Comunicação de Rede: Kestra (Docker-in-Docker) vs MinIO
**O Problema:**
O Kestra roda os scripts Python (`io.kestra.plugin.scripts.python.Script`) criando **containers Docker efêmeros** a cada execução. Esses containers temporários não nascem na mesma rede Docker (`docker-compose network`) onde o MinIO e o PostgreSQL estão rodando. Como resultado, os scripts Python falhavam ao tentar acessar `http://minio:9000` (Connection Refused).

**A Solução:**
Usar o IP de gateway da ponte padrão do Docker (`172.17.0.1`).
* **Por que funcionou:** O IP `172.17.0.1` é a rota do container para a máquina host (o seu computador real). Como expusemos a porta `9000` do MinIO para a máquina host no `docker-compose.yml` (`"9000:9000"`), os containers efêmeros conseguem acessar o MinIO batendo no IP do host.
* **Diferença:** O backend (FastAPI) continua usando `minio:9000` porque ele é um serviço fixo dentro da mesma rede do Docker Compose.

---

## 3. Schemas Mutantes na API do IBGE SIDRA
**O Problema:**
A API do IBGE SIDRA retorna um JSON onde a primeira linha atua como cabeçalho. No entanto, os nomes das chaves (`D1N`, `D2N`, `D3N`, `V`) variam dependendo da consulta, e até os nomes legíveis mudam sutilmente (ex: "Variável", "Variável", "Estado", "Unidade da Federação"). Hardcodar o índice das colunas causava quebra constante dos pipelines de transformação (Camada Silver).

**A Solução:**
Mapeamento Dinâmico por Palavras-Chave.
* **Ajuste:** No script Python (dentro do Kestra), lemos a primeira linha e usamos regras semânticas soltas (ex: `if 'ano' in val.lower()`) para identificar qual coluna representa o Ano, o Estado e a Variável, ignorando colunas de códigos internos.
* **Pivot Table:** Em seguida, usamos `df.pivot_table()` do pandas para transformar os valores das variáveis (que vinham em linhas) em colunas reais (`area_colhida_hectares`, `producao_toneladas`), garantindo um schema fixo para a Camada Silver.

---

## 4. Incompatibilidade de Tipos PyArrow vs Apache Iceberg
**O Problema:**
Ao tentar salvar os dados do mercado financeiro (CBOT/B3) de forma incremental na camada Bronze usando o Apache Iceberg (`pyiceberg`), recebíamos erros de schema mismatch. O Iceberg exige que os campos de data/hora tenham precisão estrita de microssegundos (`timestamp[us]`), mas o pandas e o `yfinance` geram datas em nanosegundos (`datetime64[ns]`) ou com timezone (`tz-aware`).

**A Solução:**
Conversão explícita de tipos antes da inserção.
* **Ajuste:** Removemos o timezone e forçamos a conversão para microssegundos no pandas antes de converter para tabela PyArrow:
```python
df['data_pregao'] = df['data_pregao'].dt.tz_localize(None)
df['data_pregao'] = pd.to_datetime(df['data_pregao']).astype('datetime64[us]')
df_arrow = pa.Table.from_pandas(df)
```

---

## 5. Bloqueio de CORS no Frontend Next.js
**O Problema:**
Ao tentar exibir os gráficos no Next.js (rodando em `http://localhost:3000`), as requisições `fetch` para a API FastAPI (rodando em `http://localhost:8000`) falhavam com o erro `Cross-Origin Request Blocked`. Isso é uma medida de segurança padrão dos navegadores para evitar que um site consuma recursos de outro domínio sem permissão.

**A Solução:**
Configurar o `CORSMiddleware` no FastAPI.
* **Ajuste:** No arquivo `main.py`, adicionamos o middleware permitindo origens cruzadas:
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Em produção, isso deve ser restrito ao IP do frontend
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

---

## 6. Gráficos "Esmagados" no Recharts com Escalas Diferentes
**O Problema:**
Nas abas "Mercado B3" e "Clima Detalhado", estávamos plotando duas métricas de grandezas completamente diferentes no mesmo gráfico (ex: Chuva na casa dos 1.000 mm vs Preço na casa dos 1.000 US$, mas Safra na casa dos 150.000.000 de toneladas). Se colocados no mesmo eixo Y, o preço e a chuva pareciam uma linha reta no chão (valor próximo a zero), esmagados pela escala gigantesca da safra.

**A Solução:**
Múltiplos eixos Y e Normalização Visual.
* **Ajuste 1:** No Recharts, configuramos dois `<YAxis />`, um à esquerda (`yAxisId="left"`) e um à direita (`yAxisId="right"`).
* **Ajuste 2:** Dividimos os valores massivos por 1.000.000 (Milhões) ou 1.000.000.000 (Bilhões) e aplicamos `tickFormatter` para exibir o sufixo "M" ou "B", mantendo os dados proporcionais na tela.

---

## 7. Consultas Lentas e Arquivos Repetidos (Carga Incremental)
**O Problema:**
Toda vez que o pipeline do Kestra rodava, ele puxava os 10 anos completos de histórico do mercado (yFinance) e sobrescrevia os arquivos antigos. Em produção, isso gera custos massivos de I/O e processamento.

**A Solução:**
Uso do Apache Iceberg para Carga Incremental (EAFP Pattern).
* **Ajuste:** O script agora tenta carregar a tabela Iceberg existente. Se ela existir, ele encontra o valor `MAX(data_pregao)`. Depois, extrai da API apenas as datas maiores que essa `MAX` e faz um `.append()` (inserção) na tabela Iceberg. Se a tabela não existir, cai no bloco `except`, cria a tabela do zero e faz a carga inicial (Full Load).
