from fastapi import FastAPI, HTTPException, BackgroundTasks
import requests
from fastapi.middleware.cors import CORSMiddleware
import duckdb
import os
from functools import lru_cache

# Inicializa a aplicação FastAPI
app = FastAPI(
    title="Agro Lakehouse API",
    description="API analítica para consulta de indicadores agropecuários",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def get_duckdb_connection():
    """
    Função auxiliar para criar uma conexão na memória e 
    configurar o acesso direto ao MinIO (nosso S3 local).
    """
    con = duckdb.connect(database=':memory:')
    endpoint = os.getenv('MINIO_ENDPOINT', 'localhost:9000')
    con.execute(f"""
        INSTALL httpfs;
        LOAD httpfs;
        SET s3_endpoint='{endpoint}';
        SET s3_access_key_id='admin';
        SET s3_secret_access_key='password123';
        SET s3_use_ssl=false;
        SET s3_url_style='path';
    """)
    return con

@app.get("/")
def read_root():
    return {"status": "A API do Lakehouse está online!"}

@lru_cache(maxsize=1)
def _fetch_anuais_from_lake():
    con = get_duckdb_connection()
    query = """
        SELECT * FROM read_parquet('s3://gold/agro_clima_economia_*.parquet')
        ORDER BY ano DESC
    """
    resultado = con.execute(query).df()
    resultado = resultado.where(resultado.notnull(), None)
    dados_json = resultado.to_dict(orient="records")
    return {"data": dados_json, "total_linhas": len(dados_json)}

@app.get("/api/v1/indicadores/anuais")
def get_indicadores_anuais():
    """
    Consome a camada GOLD do Data Lakehouse: Soja vs Dólar.
    """
    try:
        return _fetch_anuais_from_lake()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao consultar o Data Lake: {str(e)}")

@lru_cache(maxsize=1)
def _fetch_matopiba_from_lake():
    con = get_duckdb_connection()
    query = """
        SELECT * FROM read_parquet('s3://gold/matopiba_consolidado_*.parquet') 
        ORDER BY ano ASC
    """
    resultado = con.execute(query).df()
    resultado = resultado.where(resultado.notnull(), None)
    return {"data": resultado.to_dict(orient="records")}

@app.get("/api/v1/indicadores/matopiba")
def get_indicadores_matopiba():
    try:
        return _fetch_matopiba_from_lake()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro analítico: {str(e)}")

@lru_cache(maxsize=1)
def _fetch_credito_from_lake():
    con = get_duckdb_connection()
    query = """
        SELECT * FROM read_parquet('s3://gold/credito_vbp_consolidado_*.parquet') 
        ORDER BY ano ASC
    """
    resultado = con.execute(query).df()
    resultado = resultado.where(resultado.notnull(), None)
    return {"data": resultado.to_dict(orient="records")}

@app.get("/api/v1/indicadores/credito-vbp")
def get_indicadores_credito_vbp():
    try:
        return _fetch_credito_from_lake()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro analítico: {str(e)}")

@lru_cache(maxsize=1)
def _fetch_clima_from_lake():
    con = get_duckdb_connection()
    query = """
        SELECT * FROM read_parquet('s3://gold/inmet_clima_matopiba_*.parquet') 
        ORDER BY data_medicao ASC
    """
    try:
        resultado = con.execute(query).df()
        resultado = resultado.where(resultado.notnull(), None)
        return {"data": resultado.to_dict(orient="records")}
    except Exception:
        return {"data": []}

@app.get("/api/v1/indicadores/clima")
def get_indicadores_clima():
    try:
        return _fetch_clima_from_lake()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro analítico: {str(e)}")

@lru_cache(maxsize=1)
def _fetch_mercado_from_lake():
    con = get_duckdb_connection()
    query = """
        SELECT * FROM read_parquet('s3://gold/conab_b3_mercado_*.parquet') 
        ORDER BY ano ASC, mes ASC
    """
    try:
        resultado = con.execute(query).df()
        resultado = resultado.where(resultado.notnull(), None)
        return {"data": resultado.to_dict(orient="records")}
    except Exception:
        return {"data": []}

@app.get("/api/v1/indicadores/mercado")
def get_indicadores_mercado():
    try:
        return _fetch_mercado_from_lake()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro analítico: {str(e)}")

@lru_cache(maxsize=1)
def _fetch_master_from_lake():
    con = get_duckdb_connection()
    # Left join Mercado (por ano) com Clima (sum/avg por ano)
    query = """
        SELECT 
            m.ano, 
            AVG(m.media_preco_usd) as preco_soja, 
            MAX(m.estimativa_safra) as safra_toneladas,
            SUM(c.precipitacao_mm) as precipitacao_total,
            AVG(c.temperatura_media) as temperatura_media
        FROM read_parquet('s3://gold/conab_b3_mercado_*.parquet') m
        LEFT JOIN read_parquet('s3://gold/inmet_clima_matopiba_*.parquet') c
        ON m.ano = CAST(EXTRACT(year FROM c.data_medicao) AS INTEGER)
        GROUP BY m.ano
        ORDER BY m.ano ASC
    """
    try:
        resultado = con.execute(query).df()
        resultado = resultado.astype(object).where(resultado.notnull(), None)
        return {"data": resultado.to_dict(orient="records")}
    except Exception as e:
        print(f"Erro no SQL Master: {e}")
        return {"data": []}

@app.get("/api/v1/indicadores/master")
def get_indicadores_master():
    try:
        return _fetch_master_from_lake()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro analítico: {str(e)}")

def trigger_kestra_flows():
    """Função rodada em background para disparar os fluxos do Kestra"""
    # Kestra roda na porta 8080. Se rodar pelo docker, use o nome do container "kestra"
    kestra_host = os.getenv("KESTRA_ENDPOINT", "http://localhost:8080")
    namespace = "agro.lakehouse"
    
    # Lista de fluxos base que puxam dados da fonte (as transformações e o gold devem rodar automaticamente via triggers)
    flows_to_trigger = [
        "extract_ibge_sidra_soybean",
        "extract_inpe_fire_hotspots",
        "extract_ipeadata_dollar_exchange",
        "pipeline_credito_rural",
        "pipeline_matopiba_regional",
        "extract_inmet_weather",
        "extract_conab_b3"
    ]
    
    for flow in flows_to_trigger:
        try:
            url = f"{kestra_host}/api/v1/executions/{namespace}/{flow}"
            # Dispara a execução via POST
            res = requests.post(url)
            if res.status_code not in [200, 201]:
                print(f"Erro ao engatilhar {flow}: {res.text}")
        except Exception as e:
            print(f"Erro de conexão com Kestra para {flow}: {e}")

@app.post("/api/v1/sync")
def sync_lakehouse(background_tasks: BackgroundTasks):
    """
    Endpoint de webhook para reprocessar todo o Data Lakehouse.
    Dispara os fluxos principais de extração do Kestra em background.
    """
    background_tasks.add_task(trigger_kestra_flows)
    
    # Invalida o cache atual para que a próxima visita carregue os dados recém-processados
    _fetch_anuais_from_lake.cache_clear()
    _fetch_matopiba_from_lake.cache_clear()
    _fetch_credito_from_lake.cache_clear()
    _fetch_clima_from_lake.cache_clear()
    _fetch_mercado_from_lake.cache_clear()
    _fetch_master_from_lake.cache_clear()
    
    return {
        "message": "Sincronização iniciada com sucesso. Os fluxos estão rodando no orquestrador.",
        "status": "processing"
    }