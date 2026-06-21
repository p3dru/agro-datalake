import duckdb

# 1 - inicializar uma conexão com o Duck DB em memória
con = duckdb.connect(database=':memory:')

print("Configurando a conexão com o MinIO (S3 local)")

# 2 - Configurar as credenciais e o endpoint do MinIO
# Como o script roda diretamente na sua máquina física, apontamos para 'localhost:9000'
con.execute("""
    INSTALL httpfs;
    LOAD httpfs;
    SET s3_endpoint='localhost:9000';
    SET s3_access_key_id='admin';
    SET s3_secret_access_key='password123';
    SET s3_use_ssl=false;
    SET s3_url_style='path';
""")

print("Conexão configurada. Executando query analítica nos arquivos Parquet...")

# 3. Executar a query SQL usando a função 'read_parquet' apontando para o bucket silver
# O DuckDB vai ler apenas os metadados e as colunas necessárias, sem baixar o arquivo inteiro.
query = """
    SELECT 
        EXTRACT(YEAR FROM CAST(VALDATA AS TIMESTAMP)) as ano,
        COUNT(*) as total_registros,
        ROUND(AVG(CAST(VALVALOR AS DOUBLE)), 2) as media_valor,
        MIN(CAST(VALVALOR AS DOUBLE)) as valor_minimo,
        MAX(CAST(VALVALOR AS DOUBLE)) as valor_maximo
    FROM read_parquet('s3://silver/*.parquet')
    GROUP BY ano
    ORDER BY ano DESC;
"""

# Executa a query e transforma o resultado em um DataFrame para exibição limpa
df_resultado = con.execute(query).df()

print("\n=== DASHBOARD ANALÍTICO (SÉRIE HISTÓRICA) ===")
print(df_resultado.to_string(index=False))
