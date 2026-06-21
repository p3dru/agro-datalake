from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import duckdb

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
    con.execute("""
        INSTALL httpfs;
        LOAD httpfs;
        SET s3_endpoint='localhost:9000';
        SET s3_access_key_id='admin';
        SET s3_secret_access_key='password123';
        SET s3_use_ssl=false;
        SET s3_url_style='path';
    """)
    return con

@app.get("/")
def read_root():
    return {"status": "A API do Lakehouse está online!"}

@app.get("/api/v1/indicadores/anuais")
def get_indicadores_anuais():
    """
    Consome a camada GOLD do Data Lakehouse: Soja vs Dólar.
    """
    try:
        con = get_duckdb_connection()
        
        # Apontando especificamente para o novo arquivo consolidado
        query = """
            SELECT * FROM read_parquet('s3://gold/agro_clima_economia_*.parquet')
            ORDER BY ano DESC
        """
        
        resultado = con.execute(query).df()
        
        # O Pandas pode gerar valores NaN para anos muito antigos onde não há cotação do dólar
        # Substituímos NaN por None para o JSON ser gerado corretamente
        resultado = resultado.where(resultado.notnull(), None)
        
        dados_json = resultado.to_dict(orient="records")
        
        return {"data": dados_json, "total_linhas": len(dados_json)}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao consultar o Data Lake: {str(e)}")