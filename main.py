from fastapi import FastAPI, HTTPException, BackgroundTasks, Depends
import requests
from fastapi.middleware.cors import CORSMiddleware
import duckdb
import os
from functools import lru_cache
from pydantic import BaseModel
from utils.auth import verify_token, create_access_token
from pyiceberg.catalog import load_catalog
import pyarrow as pa
import pandas as pd

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
    endpoint = os.getenv('MINIO_ENDPOINT', '172.17.0.1:9000')
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

def get_iceberg_catalog():
    endpoint = os.getenv('MINIO_ENDPOINT', '172.17.0.1:9000')
    endpoint_url = endpoint if endpoint.startswith('http') else f"http://{endpoint}"
    return load_catalog(
        "default",
        **{
            "type": "sql",
            "uri": "postgresql+psycopg2://kestra:password123@postgres:5432/kestra",
            "s3.endpoint": endpoint_url,
            "s3.access-key-id": "admin",
            "s3.secret-access-key": "password123",
        }
    )

@app.get("/")
def read_root():
    return {"status": "A API do Lakehouse está online e conectada ao Iceberg!"}

class LoginModel(BaseModel):
    username: str
    password: str

@app.post("/api/v1/auth/login")
def login(user: LoginModel):
    # Credenciais hardcoded para o portfólio
    if user.username == "admin" and user.password == "agro123":
        token = create_access_token({"sub": user.username})
        return {"access_token": token, "token_type": "bearer"}
    raise HTTPException(status_code=401, detail="Credenciais inválidas")

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

@app.get("/api/v1/indicadores/anuais", dependencies=[Depends(verify_token)])
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

@app.get("/api/v1/indicadores/matopiba", dependencies=[Depends(verify_token)])
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

@app.get("/api/v1/indicadores/credito-vbp", dependencies=[Depends(verify_token)])
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

@app.get("/api/v1/indicadores/clima", dependencies=[Depends(verify_token)])
def get_indicadores_clima():
    try:
        return _fetch_clima_from_lake()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro analítico: {str(e)}")

@lru_cache(maxsize=1)
def _fetch_mercado_from_lake():
    try:
        catalog = get_iceberg_catalog()
        table = catalog.load_table("agro_gold.conab_b3_mercado")
        df_arrow = table.scan().to_arrow()
        
        con = get_duckdb_connection()
        con.register('mercado_iceberg', df_arrow)
        
        query = """
            SELECT * FROM mercado_iceberg
            ORDER BY ano ASC, mes ASC
        """
        resultado = con.execute(query).df()
        resultado = resultado.where(resultado.notnull(), None)
        return {"data": resultado.to_dict(orient="records")}
    except Exception as e:
        print(f"Erro Mercado Iceberg: {e}")
        return {"data": []}

@app.get("/api/v1/indicadores/mercado", dependencies=[Depends(verify_token)])
def get_indicadores_mercado():
    try:
        return _fetch_mercado_from_lake()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro analítico: {str(e)}")

@lru_cache(maxsize=1)
def _fetch_master_from_lake():
    try:
        catalog = get_iceberg_catalog()
        table = catalog.load_table("agro_gold.conab_b3_mercado")
        df_arrow = table.scan().to_arrow()
        
        con = get_duckdb_connection()
        con.register('mercado_iceberg', df_arrow)
        
        # Left join Mercado (Iceberg) com Clima (Parquet)
        query = """
            SELECT 
                m.ano, 
                AVG(m.media_preco_usd) as preco_soja, 
                MAX(m.estimativa_safra) as safra_toneladas,
                SUM(c.precipitacao_mm) as precipitacao_total,
                AVG(c.temperatura_media) as temperatura_media
            FROM mercado_iceberg m
            LEFT JOIN read_parquet('s3://gold/inmet_clima_matopiba_*.parquet') c
            ON m.ano = CAST(EXTRACT(year FROM c.data_medicao) AS INTEGER)
            GROUP BY m.ano
            ORDER BY m.ano ASC
        """
        resultado = con.execute(query).df()
        resultado = resultado.astype(object).where(resultado.notnull(), None)
        return {"data": resultado.to_dict(orient="records")}
    except Exception as e:
        print(f"Erro no SQL Master (Iceberg): {e}")
        return {"data": []}

@app.get("/api/v1/indicadores/master", dependencies=[Depends(verify_token)])
def get_indicadores_master():
    try:
        return _fetch_master_from_lake()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro analítico: {str(e)}")

@app.get("/api/v1/indicadores/insights", dependencies=[Depends(verify_token)])
def get_dynamic_insights():
    try:
        dados = _fetch_master_from_lake()["data"]
        if not dados or len(dados) < 3:
            return {"insight": "Dados insuficientes para análise de correlação histórica."}
        
        # Pega apenas dados completos de safra, preço e precipitação
        dados_validos = [d for d in dados if d["preco_soja"] and d["safra_toneladas"] and d["precipitacao_total"] is not None]
        if len(dados_validos) < 3:
            return {"insight": "Aguardando consolidação histórica com dados climáticos do MATOPIBA para gerar estatísticas."}
            
        df = pd.DataFrame(dados_validos)
        corr = df.corr()
        
        corr_clima_safra = corr.loc['precipitacao_total', 'safra_toneladas']
        corr_safra_preco = corr.loc['safra_toneladas', 'preco_soja']
        
        texto_clima = "forte " if abs(corr_clima_safra) > 0.6 else "moderada " if abs(corr_clima_safra) > 0.3 else "fraca "
        texto_clima += "positiva" if corr_clima_safra > 0 else "negativa"
        
        texto_preco = "forte " if abs(corr_safra_preco) > 0.6 else "moderada " if abs(corr_safra_preco) > 0.3 else "fraca "
        texto_preco += "positiva" if corr_safra_preco > 0 else "negativa"
        
        texto_final = (f"A SÉRIE HISTÓRICA MOSTRA UMA CORRELAÇÃO ESTATÍSTICA {texto_clima.upper()} ({(corr_clima_safra*100):.1f}%) "
                       f"ENTRE AS CHUVAS NO MATOPIBA E A SAFRA NACIONAL. "
                       f"A RELAÇÃO ENTRE A OFERTA DE SAFRA E O PREÇO GLOBAL EM CHICAGO É {texto_preco.upper()} ({(corr_safra_preco*100):.1f}%), "
                       "VALIDANDO A MECÂNICA DE CAUSA E EFEITO DO AGRONEGÓCIO.")
            
        return {"insight": texto_final}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

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

@app.post("/api/v1/sync", dependencies=[Depends(verify_token)])
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