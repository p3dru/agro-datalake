from fastapi.testclient import TestClient
import sys
import os

# Adiciona o diretório raiz para conseguir importar o main
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from main import app

client = TestClient(app)

def test_read_root():
    response = client.get("/")
    assert response.status_code == 200
    assert "status" in response.json()
    assert "A API do Lakehouse está online" in response.json()["status"]

def test_login_invalid():
    response = client.post(
        "/api/v1/auth/login",
        json={"username": "wrong", "password": "123"}
    )
    assert response.status_code == 401

def test_login_valid():
    response = client.post(
        "/api/v1/auth/login",
        json={"username": "admin", "password": "agro123"}
    )
    assert response.status_code == 200
    assert "access_token" in response.json()
