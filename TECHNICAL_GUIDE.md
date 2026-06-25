# 📚 Guia Técnico Aprofundado — Mini Lakehouse Agro

> **Para quem é este documento?**  
> Este guia foi escrito para você, que construiu esse sistema com assistência de IA e quer entender **o que é cada coisa**, **por que funciona** e **o que estudar** para evoluir como Engenheiro de Dados. Cada bloco de código é explicado em linguagem natural.

---

## Parte 1 — O Problema que Estamos Resolvendo

Antes de entender o código, é fundamental entender **qual problema o sistema resolve**.

### O que é um Data Lakehouse?

Imagine que você tem dados chegando de 5 lugares diferentes: IBGE, satélites do INPE, bolsa de valores, estações meteorológicas e banco central. Cada um tem formato diferente (JSON, CSV, API REST), periodicidade diferente (diário, anual) e nível de qualidade diferente.

**O problema sem um Lakehouse:**
- Cada análise faz uma chamada direta à API → lento, instável, caro em requisições
- Os dados ficam espalhados, sem histórico
- Se a API do IBGE mudar, o código de análise quebra junto

**A solução (Medallion Architecture):**
```
[APIs Externas] → [Bronze] → [Silver] → [Gold] → [API/Dashboard]
                   Bruto     Limpo      Pronto
```

Você separa completamente a **coleta** da **transformação** da **análise**. Cada camada tem uma responsabilidade única.

---

## Parte 2 — A Infraestrutura (docker-compose.yml)

### Por que Docker Compose?

O projeto tem 5 serviços que precisam conversar entre si. Sem Docker:
- Você instalaria MinIO, PostgreSQL, Kestra e Node na sua máquina
- Cada um teria conflito de versão com o outro
- Não funcionaria no computador de outra pessoa

Com Docker Compose, você descreve **o que rodar** em YAML, e o Docker cuida do resto.

### Analisando o docker-compose.yml linha a linha

```yaml
services:
  minio:
    image: minio/minio:latest
    ports:
      - "9000:9000"   # API S3 (usada pelo Python/DuckDB)
      - "9001:9001"   # Interface web de administração
    environment:
      MINIO_ROOT_USER: admin
      MINIO_ROOT_PASSWORD: password123
    command: server /data --console-address ":9001"
    volumes:
      - minio_data:/data   # Persistência em volume Docker
```

**O que é o MinIO?**  
É um servidor de objetos (arquivos) que fala o mesmo idioma do Amazon S3. Isso é crucial: os scripts Python usam a biblioteca `boto3` (a biblioteca oficial da AWS) para se comunicar com o MinIO. Na prática, você poderia trocar o MinIO pela AWS S3 real mudando apenas as credenciais e o `endpoint_url`.

**O que são "volumes" Docker?**  
Sem volumes, todo dado some quando o container é destruído. O `minio_data:/data` diz: "salve o conteúdo da pasta `/data` dentro do container em um volume Docker chamado `minio_data`". Esse volume persiste mesmo após `docker compose down`.

```yaml
  postgres:
    image: postgres:15
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -d $${POSTGRES_DB} -U $${POSTGRES_USER}"]
      interval: 10s
      retries: 5
```

**Por que PostgreSQL está aqui se o banco é MinIO?**  
O PostgreSQL é o **metastore** — ele não guarda os dados em si, mas sim os **metadados** (quais tabelas existem, onde estão os arquivos, quais schemas). Tanto o Kestra quanto o Apache Iceberg usam o PostgreSQL para isso.

O `healthcheck` garante que o Kestra só sobe depois que o Postgres está 100% pronto para receber conexões (sem isso, o Kestra tentaria conectar antes do Postgres estar online e falharia).

```yaml
  kestra:
    user: "root"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
```

**Por que o Kestra precisa ser `root` e ter acesso ao `docker.sock`?**  
O Kestra executa scripts Python em **containers Docker efêmeros** (containers que nascem e morrem a cada execução). Para criar containers, ele precisa falar com o daemon do Docker — que fica no socket `/var/run/docker.sock`. Montar esse socket dentro do container do Kestra é a forma padrão de dar esse acesso.

```yaml
  backend:
    build:
      context: .
      dockerfile: Dockerfile.backend
    environment:
      - MINIO_ENDPOINT=minio:9000   # Nome do container, não localhost!
```

**Por que `minio:9000` e não `localhost:9000`?**  
Containers Docker se comunicam pela rede interna do Compose. Dentro da rede, cada container é acessível pelo **nome do serviço** (`minio`, `postgres`, `kestra`). O `localhost` dentro do container `backend` se refere ao próprio container, não ao MinIO.

---

## Parte 3 — O Dockerfile do Backend

```dockerfile
FROM python:3.11-slim    # Imagem base mínima do Python 3.11

WORKDIR /app             # Define o diretório de trabalho dentro do container

COPY requirements.txt .  # Copia APENAS o requirements primeiro (otimização de cache)
RUN pip install --no-cache-dir -r requirements.txt

COPY main.py .           # Copia o código da aplicação
COPY utils/ ./utils/

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

**Por que copiar o `requirements.txt` antes do `main.py`?**  
Docker tem um sistema de cache por camada. Se você copiasse tudo junto com `COPY . .`, toda vez que mudasse uma linha do `main.py` o Docker reinstalaria todas as dependências — processo que leva minutos. Separando, o Docker só reinstala as dependências quando o `requirements.txt` muda, e usa o cache para tudo o mais.

**O que é `uvicorn`?**  
FastAPI é um framework web, mas não é um servidor web em si. O `uvicorn` é o servidor ASGI (Asynchronous Server Gateway Interface) que executa a aplicação FastAPI. O `--host 0.0.0.0` significa "aceite conexões de qualquer IP" (necessário dentro do Docker para que o host externo consiga acessar).

---

## Parte 4 — O Backend (main.py) — Dissecando Cada Parte

### 4.1 A Conexão com o MinIO via DuckDB

```python
def get_duckdb_connection():
    con = duckdb.connect(database=':memory:')  # Banco em memória (sem arquivo em disco)
    endpoint = os.getenv('MINIO_ENDPOINT', '172.17.0.1:9000')
    con.execute(f"""
        INSTALL httpfs;      -- Instala a extensão de acesso HTTP/S3
        LOAD httpfs;         -- Carrega a extensão
        SET s3_endpoint='{endpoint}';        -- Aponta para o MinIO em vez da AWS
        SET s3_access_key_id='admin';
        SET s3_secret_access_key='password123';
        SET s3_use_ssl=false;               -- MinIO local não usa HTTPS
        SET s3_url_style='path';            -- Estilo /bucket/arquivo (MinIO) vs bucket.domínio.com (AWS)
    """)
    return con
```

**O que é DuckDB?**  
DuckDB é um banco de dados analítico embutido (como SQLite, mas feito para análise em vez de transações). Ele roda **dentro do processo Python**, sem servidor separado. A grande sacada é que ele consegue ler arquivos Parquet diretamente do S3/MinIO via SQL, sem precisar baixar o arquivo inteiro para memória primeiro.

**`':memory:'` significa que os dados somem?**  
Sim, mas isso é intencional! O DuckDB aqui é apenas um **motor de query**. Os dados reais estão no MinIO. O DuckDB conecta, executa o SQL que lê do MinIO, retorna o resultado e a conexão pode ser descartada. Não precisamos persistir nada localmente.

**Por que `172.17.0.1` como fallback?**  
`172.17.0.1` é o IP do host Docker (a máquina real) visto de dentro de um container. Quando o Kestra roda scripts Python em containers efêmeros, eles não estão na mesma rede Docker do `minio`. Portanto, eles acessam o MinIO pelo IP do host, que é `172.17.0.1`. O backend FastAPI, por estar na rede Docker, usa `minio:9000`.

### 4.2 O Catálogo Apache Iceberg

```python
def get_iceberg_catalog():
    endpoint = os.getenv('MINIO_ENDPOINT', '172.17.0.1:9000')
    endpoint_url = endpoint if endpoint.startswith('http') else f"http://{endpoint}"
    return load_catalog(
        "default",
        **{
            "type": "sql",                    # Tipo de catálogo: SQL (via PostgreSQL)
            "uri": "postgresql+psycopg2://kestra:password123@postgres:5432/kestra",
            "s3.endpoint": endpoint_url,
            "s3.access-key-id": "admin",
            "s3.secret-access-key": "password123",
        }
    )
```

**O que é Apache Iceberg?**  
Iceberg é um formato de tabela aberto que fica **em cima** dos arquivos Parquet. É como uma camada de gerenciamento que adiciona:
- **ACID**: garantia de que operações de escrita são atômicas (não ficam a meio)
- **Schema evolution**: você pode adicionar/renomear colunas sem recriar a tabela
- **Time travel**: `SELECT * FROM tabela AS OF '2024-01-01'` — consultar dados históricos
- **Carga incremental**: saber quais linhas foram adicionadas/modificadas

**Por que o catálogo é "sql"?**  
O catálogo é onde o Iceberg registra os metadados das tabelas (quais arquivos Parquet pertencem à tabela, qual é o schema, etc). Existem tipos diferentes: Hive, Glue (AWS), REST e SQL. O tipo `sql` usa um banco relacional (PostgreSQL aqui) para guardar esses metadados.

### 4.3 O Sistema de Cache com @lru_cache

```python
@lru_cache(maxsize=1)
def _fetch_master_from_lake():
    # Consulta cara ao MinIO/Iceberg...
    return {"data": dados}
```

**O que é `@lru_cache`?**  
É um **decorador** do Python que armazena o resultado da função em memória. Na primeira chamada, executa tudo e guarda o resultado. Nas chamadas seguintes, retorna o resultado guardado sem executar nada.

**Por que `maxsize=1`?**  
A função não recebe argumentos (o token não é parâmetro dela), então há apenas 1 combinação possível de entrada. O cache armazena apenas o último resultado único.

**Por que isso é necessário?**  
Cada chamada ao MinIO para ler arquivos Parquet pode levar 1-2 segundos. Se 10 usuários abrirem o dashboard ao mesmo tempo, sem cache você faria 50 leituras ao MinIO. Com cache, a primeira pessoa paga o custo, as outras 9 recebem instantaneamente.

**Como o cache é invalidado?**
```python
@app.post("/api/v1/sync")
def sync_lakehouse():
    _fetch_master_from_lake.cache_clear()  # Limpa o cache manualmente
    # ...
```

O botão "Sincronizar Dados" no frontend chama esse endpoint, que limpa todos os caches, forçando a próxima consulta a ir ao MinIO buscar os dados mais recentes.

### 4.4 O Motor de Correlação de Pearson

```python
@app.get("/api/v1/indicadores/insights")
def get_dynamic_insights():
    dados = _fetch_master_from_lake()["data"]
    
    # Mínimo de 3 pontos para estatística ser significativa
    dados_validos = [d for d in dados if d["preco_soja"] and d["safra_toneladas"] and d["precipitacao_total"] is not None]
    
    df = pd.DataFrame(dados_validos)
    corr = df.corr()  # Calcula a matriz de correlação de Pearson
    
    corr_clima_safra = corr.loc['precipitacao_total', 'safra_toneladas']
    corr_safra_preco = corr.loc['safra_toneladas', 'preco_soja']
```

**O que é a Correlação de Pearson?**  
É uma medida estatística que quantifica a relação linear entre duas variáveis. O resultado (chamado de "r") vai de -1 a 1:
- `r = 1.0`: Relação linear perfeita positiva (quando X sobe, Y sobe na mesma proporção)
- `r = -1.0`: Relação linear perfeita negativa (quando X sobe, Y desce)
- `r = 0.0`: Nenhuma correlação linear

No nosso caso, estamos calculando `corr_clima_safra`: quando as chuvas aumentam, a safra aumenta? E `corr_safra_preco`: quando a safra aumenta, o preço cai (lei da oferta)?

**O que é `df.corr()`?**  
O método `.corr()` do pandas calcula automaticamente a correlação de Pearson entre **todas as combinações** de colunas numéricas do DataFrame. O resultado é uma matriz NxN onde cada célula `[i][j]` é a correlação entre a coluna `i` e a coluna `j`. A diagonal principal (correlação de X com X) é sempre 1.0.

**O que é `corr.loc['precipitacao_total', 'safra_toneladas']`?**  
`.loc[]` é o seletor de linhas/colunas do pandas por **label** (rótulo). Aqui estamos pegando a célula específica da matriz onde a linha é `precipitacao_total` e a coluna é `safra_toneladas`.

### 4.5 O JOIN Mestre no DuckDB

```python
query = """
    SELECT 
        m.ano, 
        AVG(m.media_preco_usd) as preco_soja,          -- Média do preço anual
        MAX(m.estimativa_safra) as safra_toneladas,     -- MAX porque o dado é constante por ano
        SUM(c.precipitacao_mm) as precipitacao_total,   -- SOMA de todos os dias do ano
        AVG(c.temperatura_media) as temperatura_media
    FROM mercado_iceberg m                               -- Tabela Iceberg (mensalizada)
    LEFT JOIN read_parquet('s3://gold/inmet_clima_matopiba_*.parquet') c
    ON m.ano = CAST(EXTRACT(year FROM c.data_medicao) AS INTEGER)
    GROUP BY m.ano
    ORDER BY m.ano ASC
"""
```

**O que é um `LEFT JOIN`?**  
Um JOIN combina duas tabelas baseado em uma condição. O `LEFT` significa: "retorne TODAS as linhas da tabela da esquerda (`m`), mesmo que não haja linha correspondente na tabela da direita (`c`)". Se não há dado climático para um ano, o ano ainda aparece na tabela com `NULL` para as colunas de clima.

**O `*` no path do Parquet — o que significa?**  
`read_parquet('s3://gold/inmet_clima_matopiba_*.parquet')` usa um wildcard (*). O DuckDB lê **todos os arquivos** que casam com o padrão. Como cada execução do pipeline gera um arquivo com timestamp (ex: `inmet_clima_matopiba_20240625_120000.parquet`), o wildcard garante que todos sejam lidos como se fossem uma única tabela.

**Por que `SUM(precipitacao_mm)` e `AVG(media_preco_usd)` para o mesmo agrupamento por ano?**  
São métricas de natureza diferente:
- Precipitação é **acumulável**: faz sentido somar os mm de chuva de todos os dias do ano
- Preço é **não acumulável**: a média mensal do preço já é a média representativa do ano

---

## Parte 5 — Os Pipelines Kestra (Flows)

### 5.1 Como o Kestra executa código Python?

```yaml
tasks:
  - id: python_extract_bronze
    type: io.kestra.plugin.scripts.python.Script
    containerImage: python:3.11-slim        # Imagem Docker a ser criada
    taskRunner:
      type: io.kestra.plugin.core.runner.Process
    beforeCommands:
      - pip install requests pandas duckdb  # Roda antes do script
    script: |                               # O código Python em si
      import requests
      ...
```

**O que acontece por baixo quando esse task roda?**
1. Kestra pede ao Docker para criar um container `python:3.11-slim`
2. Dentro desse container, roda `pip install requests pandas duckdb`
3. Executa o script Python
4. Mata o container e limpa tudo

Isso é poderoso porque cada execução é **completamente isolada**. Uma execução não interfere na outra. As dependências são instaladas do zero toda vez — o que é lento (por isso produção usa imagens customizadas pré-instaladas), mas correto para desenvolvimento.

### 5.2 A Cadeia de Subflows (Encadeamento)

```yaml
  - id: trigger_silver
    type: io.kestra.plugin.core.flow.Subflow
    flowId: transform_conab_b3_to_silver   # ID do próximo flow
    namespace: agro.lakehouse
    wait: false                            # Dispara e não espera terminar
```

O encadeamento `extract → transform → gold` funciona porque cada flow tem um task `trigger_*` no final. O `wait: false` é **assíncrono** — o flow atual termina imediatamente após disparar o próximo, sem aguardar sua conclusão. Isso libera recursos mais rapidamente.

### 5.3 O Pivot Table na Transformação do IBGE

O dado bruto que chega da API do IBGE tem este formato (linhas):
```
Ano  | Estado       | Variável              | Valor
-----|--------------|------------------------|-------
2022 | Bahia        | Área colhida (Hectares)| 5000000
2022 | Bahia        | Quantidade produzida   | 15000000
2022 | Maranhão     | Área colhida (Hectares)| 2000000
2022 | Maranhão     | Quantidade produzida   | 8000000
```

Mas o que queremos para análise é este formato (colunas):
```
Ano  | Estado   | area_colhida_hectares | producao_toneladas
-----|----------|-----------------------|-------------------
2022 | Bahia    | 5000000               | 15000000
2022 | Maranhão | 2000000               | 8000000
```

O `pivot_table` faz exatamente essa transformação:

```python
df_pivot = df.pivot_table(
    index=['ano', 'estado'],    # Essas colunas viram o índice (linhas)
    columns='variavel',         # Os valores únicos dessa coluna viram colunas
    values='valor',             # O valor a preencher nas células
    aggfunc='sum'               # Se houver duplicatas, soma
).reset_index()                 # Transforma o índice de volta em colunas normais
```

### 5.4 A Carga Incremental do Apache Iceberg

```python
try:
    table = catalog.load_table(table_id)      # Tenta carregar a tabela existente
    df_existing = table.scan().to_pandas()
    
    if not df_existing.empty:
        max_date = pd.to_datetime(df_existing['data_pregao']).max()
        print(f"Modo Incremental: Maior data na base é {max_date}")
        
        # Filtra apenas os registros mais novos que já temos
        df_b3 = df_b3[pd.to_datetime(df_b3['data_pregao']) > max_date]
        
        if df_b3.empty:
            print("Nenhum dado novo. Finalizando.")
            exit(0)
        
        table.append(df_arrow)  # Adiciona apenas os novos registros
        
except Exception as e:
    # Tabela não existe ainda — cria do zero
    table = catalog.create_table(table_id, schema=df_arrow.schema, location="s3://bronze/...")
    table.append(df_arrow)
```

**Por que isso é importante?**  
O yFinance retorna 10 anos de cotações. Sem carga incremental, toda execução apagaria e recriaria 10 anos de dados, o que:
1. É lento (muito dado para processar)
2. Desperdiça storage (dados que já existem)
3. Em produção, pode gerar inconsistências durante a reescrita

Com carga incremental, após a primeira carga completa, cada execução adiciona apenas os pregões do último dia ou semana.

**O padrão try/except para criar ou atualizar:**  
Em vez de primeiro checar se a tabela existe com um `if`, tentamos carregar direto e tratamos a exceção se ela não existir. Esse padrão se chama **EAFP** (Easier to Ask Forgiveness than Permission) — comum em Python e mais performático do que verificações prévias.

---

## Parte 6 — A API FastAPI — Conceitos Fundamentais

### 6.1 O que é uma API REST?

REST é uma convenção (não um protocolo) para estruturar comunicação entre sistemas via HTTP. Os princípios básicos são:
- **GET**: buscar dados (sem efeito colateral)
- **POST**: criar/enviar dados
- **PUT**: atualizar dados completamente
- **DELETE**: apagar dados

No nosso projeto, o frontend JavaScript faz chamadas `fetch()` para os endpoints do FastAPI, que consulta o MinIO/Iceberg e retorna JSON.

### 6.2 Dependency Injection — Como o JWT protege os endpoints

```python
@app.get("/api/v1/indicadores/master", dependencies=[Depends(verify_token)])
def get_indicadores_master():
    ...
```

**O que é `Depends()`?**  
É o sistema de injeção de dependências do FastAPI. `Depends(verify_token)` significa: "antes de executar essa função, execute a função `verify_token`. Se ela levantar uma exceção, não execute a minha função e retorne o erro".

**O que `verify_token` faz?**
```python
def verify_token(credentials: HTTPAuthorizationCredentials = Security(security)):
    token = credentials.credentials    # Extrai o token do header "Authorization: Bearer xyz"
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload                 # Token válido: retorna os dados do payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expirado")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token inválido")
```

### 6.3 JWT — Como funciona na prática

JWT (JSON Web Token) tem 3 partes separadas por ponto:
```
eyJhbGci...  .  eyJzdWIi...  .  SflKxwRJ...
   Header         Payload        Assinatura
```

- **Header**: algoritmo usado (`HS256`)
- **Payload**: dados (usuário, quando expira) — **NÃO É CRIPTOGRAFADO**, apenas codificado em Base64
- **Assinatura**: hash do header + payload usando a `SECRET_KEY`

**A assinatura impede falsificação.** Qualquer um pode decodificar o payload e ver "sub: admin", mas sem a `SECRET_KEY` não consegue gerar uma assinatura válida. O servidor valida a assinatura e rejeita tokens falsos.

---

## Parte 7 — O Frontend Next.js — Explicando cada decisão

### 7.1 O que é "use client"?

```tsx
"use client";
```

Next.js tem dois modos de renderização:
- **Server Components** (padrão): o componente roda no servidor, gera HTML e manda para o browser. Bom para SEO e performance inicial
- **Client Components** (`"use client"`): o componente roda no browser, tem acesso a `useState`, `useEffect`, eventos etc.

Nosso `page.tsx` usa `"use client"` porque:
1. Precisamos de `useState` para guardar o token JWT, os dados dos gráficos etc
2. Precisamos de `useEffect` para fazer chamadas à API quando o componente monta
3. Os gráficos do Recharts são interativos (hover, click) — precisam de browser

### 7.2 O Ciclo de Vida dos Dados no Frontend

```tsx
// 1. Estado inicial — arrays vazios
const [dataMercado, setDataMercado] = useState([]);

// 2. Quando o token é obtido (login), busca os dados
useEffect(() => {
    if (!token) return;   // Só executa se tiver token
    
    const headers = { 'Authorization': `Bearer ${token}` };
    
    fetch('http://localhost:8000/api/v1/indicadores/mercado', { headers })
        .then(res => res.json())        // Converte a resposta HTTP para JSON
        .then(json => setDataMercado(json.data || []))  // Atualiza o estado
        .catch(err => console.error("Erro Mercado:", err));
        
}, [token]);  // A dependência [token] significa: "re-execute quando o token mudar"
```

**O que é `useEffect`?**  
É um Hook do React que executa código após o componente ser renderizado. O array de dependências (`[token]`) controla quando o efeito re-executa:
- `[]` (array vazio): só na montagem inicial do componente
- `[token]`: sempre que `token` mudar
- Sem array: toda vez que qualquer estado mudar (geralmente um bug)

**O que é o fluxo `fetch → .then → .then`?**  
É Promise chaining. Como chamadas de rede são assíncronas (demoram tempo indeterminado), o JavaScript usa Promises para lidar com isso sem bloquear a thread. Cada `.then()` recebe o resultado do anterior.

### 7.3 O Recharts — Como funciona a renderização dos gráficos

```tsx
<ResponsiveContainer width="100%" height="100%">
    <ComposedChart data={chartData} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
        
        <CartesianGrid strokeDasharray="3 3" />  {/* Grade de fundo */}
        <XAxis dataKey="ano" />                   {/* Eixo X usa a chave "ano" dos objetos */}
        
        {/* Dois eixos Y com IDs para distinguir */}
        <YAxis yAxisId="preco" orientation="left"  stroke="#ff4500" />
        <YAxis yAxisId="chuva" orientation="right" stroke="#0000ff" />
        
        <Tooltip formatter={(value, name) => [`US$ ${value}`, name]} />
        <Legend />
        
        {/* Cada série referencia um yAxisId e um dataKey do objeto de dados */}
        <Bar  yAxisId="chuva" dataKey="precipitacao_total" fill="#0000ff" />
        <Line yAxisId="preco" dataKey="preco_soja"          stroke="#ff4500" />
        
    </ComposedChart>
</ResponsiveContainer>
```

**O `data` prop do `ComposedChart` é um array de objetos:**
```javascript
[
    { ano: 2020, preco_soja: 1200.5, precipitacao_total: 850, safra_toneladas: 120000000 },
    { ano: 2021, preco_soja: 1450.2, precipitacao_total: 1100, safra_toneladas: 135000000 },
    ...
]
```

O Recharts itera esse array. Para cada objeto, ele usa `dataKey` para saber qual propriedade do objeto renderizar em cada série.

**Por que dois eixos Y?**  
O preço da soja é ~1200 USD e a precipitação é ~800 mm. Se usassem o mesmo eixo, um deles ficaria invisível (escalas muito diferentes). Dois eixos Y permitem que cada série tenha sua própria escala, tornando ambas visíveis e legíveis.

### 7.4 O `useMemo` nas transformações de dados

```tsx
const chartData = useMemo(() => {
    return data.map(item => ({
        ...item,
        dataFormatada: new Date(item.data_medicao).toLocaleDateString('pt-BR'),
        precipitacao_mm: Number(item.precipitacao_mm || 0).toFixed(2),
    }));
}, [data]);   // Só recalcula quando "data" mudar
```

**O que é `useMemo`?**  
É um Hook que **memoiza** (cacheia) o resultado de uma computação cara. Se `data` não mudou, o React retorna o resultado anterior sem re-executar a função.

Sem `useMemo`, toda vez que o usuário hover sobre o gráfico (que dispara re-renders), o `data.map()` seria re-executado com milhares de pontos. Com `useMemo`, o cálculo só acontece quando os dados realmente mudam.

### 7.5 O Componente TooltipBox

```tsx
export default function TooltipBox({ text }: { text: string }) {
    const [show, setShow] = useState(false);
    
    return (
        <div 
            onMouseEnter={() => setShow(true)}   // Mostra ao entrar com o mouse
            onMouseLeave={() => setShow(false)}  // Esconde ao sair
        >
            <span className="bg-[#ccff00] ...">?</span>
            
            {show && (   // Renderização condicional — só exibe se show === true
                <div className="absolute ... z-50 w-72">
                    {text}
                </div>
            )}
        </div>
    );
}
```

**`{ text }` na assinatura — o que é isso?**  
É desestruturação de objetos em TypeScript. `{ text }: { text: string }` significa:
- Receba um objeto `props`
- Desestruture a propriedade `text` desse objeto
- Essa propriedade é do tipo `string`

Quando você usa `<TooltipBox text="algum texto" />`, o React passa `{ text: "algum texto" }` como argumento.

**O que é `z-50` no Tailwind?**  
É a propriedade CSS `z-index: 50`. Elementos com z-index maior ficam na frente de elementos com z-index menor. O tooltip precisa aparecer sobre os outros elementos da página.

---

## Parte 8 — O Formato Parquet — Por que não usar CSV?

O Parquet é um formato de arquivo **colunar binário**. Para entender a diferença:

**CSV (formato linha a linha):**
```
ano,estado,producao_toneladas,area_hectares
2022,Bahia,15000000,5000000
2022,Maranhão,8000000,2000000
```

**Parquet (formato colunar):**
```
[Coluna ano]:        [2022, 2022, ...]
[Coluna estado]:     [Bahia, Maranhão, ...]
[Coluna producao]:   [15000000, 8000000, ...]
```

**Por que colunar é melhor para análise?**  
Se você quer `SELECT SUM(producao_toneladas) FROM tabela`, precisa ler APENAS a coluna `producao_toneladas`. Em CSV, você leria todas as colunas de todas as linhas. Em Parquet, você lê apenas os bytes da coluna relevante — muito mais rápido e eficiente em I/O.

**Outras vantagens do Parquet:**
- **Compressão automática**: valores repetidos (como nomes de estados) comprimem muito bem
- **Schema embutido**: o arquivo carrega seu próprio schema (tipos de cada coluna)
- **Integração nativa**: pandas, DuckDB, Spark, BigQuery — todos leem Parquet nativamente

---

## Parte 9 — O CI/CD (GitHub Actions)

```yaml
name: CI/CD Pipeline

on:
  push:
    branches: ["main"]      # Executa quando fizer push na main
  pull_request:
    branches: ["main"]      # Executa quando abrir um PR para a main

jobs:
  test-and-validate:
    runs-on: ubuntu-latest   # GitHub fornece uma VM Ubuntu gratuita

    steps:
    - uses: actions/checkout@v3    # Clona o repositório na VM

    - name: Set up Python 3.11
      uses: actions/setup-python@v4
      with:
        python-version: '3.11'

    - name: Install dependencies
      run: pip install fastapi httpx pytest great_expectations pandas

    - name: Run Schema Tests (Great Expectations)
      run: |
        python -c "
        import pandas as pd
        import great_expectations as ge
        
        df = pd.DataFrame({'ano': [2024], 'preco_soja': [1000.0], ...})
        gdf = ge.from_pandas(df)
        assert gdf.expect_column_values_to_not_be_null('ano').success
        "

    - name: Run API Unit Tests
      run: pytest tests/
```

**Por que ter CI/CD em um projeto de portfólio?**  
Demonstra que você conhece práticas de engenharia de software profissional. Em empresas, nenhum código vai para produção sem passar por testes automatizados. O CI/CD garante isso automaticamente a cada commit.

**O que é Great Expectations?**  
É uma biblioteca de validação de dados. `expect_column_values_to_not_be_null('ano')` é um "expectation" — uma afirmação sobre como os dados devem ser. Se a afirmação falhar, o pipeline CI/CD falha, impedindo que código defeituoso chegue ao repositório principal.

---

## Parte 10 — O que Estudar para Evoluir

### 10.1 Conceitos Fundamentais (Base)

| Tema | Recursos |
|:-----|:---------|
| **Python para Dados** | Docs do pandas, Real Python |
| **SQL Analítico** | Mode Analytics SQL Tutorial, StrataScratch |
| **HTTP e APIs REST** | MDN Web Docs, FastAPI Tutorial |
| **Docker** | Docker Official Get Started |
| **Git/GitHub** | Atlassian Git Tutorial |

### 10.2 Engenharia de Dados (Próximo Nível)

| Tema | O que é | Onde Aprender |
|:-----|:--------|:--------------|
| **Apache Spark** | DuckDB para petabytes | Databricks Free Courses |
| **dbt (Data Build Tool)** | Transformações SQL versionadas | dbt Learn |
| **Apache Airflow** | Alternativa mais robusta ao Kestra | Astronomer.io |
| **Delta Lake / Apache Iceberg** | Formatos de tabela abertos | Documentação oficial |
| **Streaming (Kafka)** | Dados em tempo real | Confluent Developer |

### 10.3 O que Melhorar Neste Projeto

```
NÍVEL INICIANTE:
□ Mover credenciais para variáveis de ambiente (.env)
□ Adicionar mais testes unitários (pelo menos 80% de cobertura)
□ Implementar logging estruturado (ao invés de print())

NÍVEL INTERMEDIÁRIO:
□ Adicionar autenticação com refresh token
□ Implementar paginação nos endpoints da API
□ Adicionar Prometheus + Grafana para monitoramento
□ Criar imagens Docker customizadas com as dependências pré-instaladas (Kestra)

NÍVEL AVANÇADO:
□ Migrar transformações Silver/Gold para dbt
□ Implementar qualidade de dados com Great Expectations no pipeline
□ Adicionar Kafka para streaming de cotações em tempo real
□ Deploy em cloud (AWS, GCP, Azure) usando Terraform
```

### 10.4 Padrões de Código que Você Usou Sem Saber

| Padrão | Onde Aparece no Projeto | Descrição |
|:-------|:------------------------|:----------|
| **Repository Pattern** | `_fetch_*_from_lake()` | Abstrair a fonte de dados da lógica de negócio |
| **Decorator Pattern** | `@lru_cache`, `@app.get()` | Adicionar comportamento sem modificar a função |
| **EAFP** (try/except) | Carga incremental do Iceberg | Tentar e tratar erros vs verificar antes |
| **Medallion Architecture** | Bronze/Silver/Gold | Estruturar dados em camadas de qualidade |
| **Dependency Injection** | `Depends(verify_token)` | Injetar dependências sem acoplamento |
| **Reactive/Declarative UI** | useState + useEffect | UI como função do estado |
| **Memoization** | `useMemo`, `@lru_cache` | Cachear resultados de computações caras |

---

## Glossário Rápido

| Termo | Significado Simples |
|:------|:--------------------|
| **API** | Interface para sistemas conversarem via HTTP |
| **Parquet** | Formato de arquivo colunar, eficiente para análise |
| **Iceberg** | Camada de gerenciamento sobre Parquet (ACID, schema evolution) |
| **DuckDB** | Banco analítico embutido que roda dentro do Python |
| **MinIO** | Servidor de arquivos que fala o idioma do Amazon S3 |
| **Kestra** | Orquestrador: executa pipelines Python em sequência |
| **JWT** | Token de autenticação assinado criptograficamente |
| **CORS** | Política do browser que controla quais origens podem fazer requests |
| **Parquet wildcard** | `*.parquet` — ler múltiplos arquivos como uma tabela única |
| **Pivot Table** | Rotacionar linhas em colunas (transformação de formato) |
| **Correlação de Pearson** | Medir a relação linear entre dois conjuntos de números (-1 a 1) |
| **LRU Cache** | Cache que descarta os itens menos recentemente usados |
| **Medallion** | Arquitetura Bronze/Silver/Gold de progressão de qualidade |
| **ACID** | Atomicidade, Consistência, Isolamento, Durabilidade — propriedades de transações confiáveis |
| **Schema Evolution** | Capacidade de alterar a estrutura da tabela sem recriar todos os dados |
| **Subflow** | Um pipeline que dispara outro pipeline como parte de seu fluxo |
| **Container efêmero** | Container que nasce para uma tarefa e é destruído ao terminar |
| **SSR** | Server-Side Rendering — Next.js gera HTML no servidor |
| **Hook** | Função especial do React (`useState`, `useEffect`, `useMemo`) |
| **Promise** | Objeto JavaScript que representa uma operação assíncrona futura |
| **Desestruturação** | Extrair propriedades de objetos diretamente em variáveis |
