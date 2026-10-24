"""Interface web do baixador. Rode: python app.py  e abra http://127.0.0.1:5000"""

import os
import shutil
import subprocess
import threading
import time
import uuid

from flask import Flask, abort, jsonify, render_template, request, send_from_directory

from baixar_musica import PASTA_DESTINO, baixar, link_valido

app = Flask(__name__)
PASTA_CAPAS = PASTA_DESTINO / ".capas"

# Downloads: id -> {etapa, porcentagem, criado, resultado, erro}
tarefas: dict[str, dict] = {}
VALIDADE_TAREFA = 15 * 60  # segundos
MAX_DOWNLOADS_SIMULTANEOS = 3

# Só aceita requisições endereçadas ao próprio computador. Isso bloqueia o
# "DNS rebinding", em que um site malicioso se passa por 127.0.0.1.
HOSTS_PERMITIDOS = {"127.0.0.1", "localhost"}

POLITICA_CONTEUDO = "; ".join([
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src https://fonts.gstatic.com",
    "img-src 'self' data:",
    "media-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
])


@app.before_request
def proteger():
    host = (request.host or "").rsplit(":", 1)[0].strip("[]").lower()
    if host not in HOSTS_PERMITIDOS:
        abort(403)
    # Pedidos que alteram algo só podem vir da própria página
    if request.method == "POST":
        origem = request.headers.get("Origin")
        if origem and origem != request.host_url.rstrip("/"):
            abort(403)


@app.after_request
def cabecalhos_seguranca(resposta):
    resposta.headers["Content-Security-Policy"] = POLITICA_CONTEUDO
    resposta.headers["X-Content-Type-Options"] = "nosniff"
    resposta.headers["X-Frame-Options"] = "DENY"
    resposta.headers["Referrer-Policy"] = "no-referrer"
    resposta.headers["Cross-Origin-Resource-Policy"] = "same-origin"
    return resposta


def mp3_da_biblioteca(nome: str):
    """Devolve o caminho do MP3 se ele estiver direto na pasta de músicas; senão None."""
    caminho = (PASTA_DESTINO / nome).resolve()
    if caminho.parent != PASTA_DESTINO.resolve() or caminho.suffix.lower() != ".mp3" or not caminho.is_file():
        return None
    return caminho


def limpar_tarefas_antigas() -> None:
    limite = time.time() - VALIDADE_TAREFA
    for id_tarefa in [i for i, t in tarefas.items() if t["criado"] < limite]:
        tarefas.pop(id_tarefa, None)


def executar(id_tarefa: str, url: str) -> None:
    tarefa = tarefas[id_tarefa]

    def ao_progredir(etapa: str, pct: float) -> None:
        tarefa.update(etapa=etapa, porcentagem=pct)

    resultado = baixar(url, mostrar_progresso=False, ao_progredir=ao_progredir)
    if resultado:
        tarefa.update(etapa="pronto", porcentagem=100, resultado=resultado)
    else:
        tarefa.update(etapa="erro", erro="Não foi possível baixar esse vídeo.")


@app.get("/")
def inicio():
    return render_template("index.html")


@app.post("/api/baixar")
def api_baixar():
    url = (request.get_json(silent=True) or {}).get("url", "").strip()
    if not link_valido(url):
        return jsonify(ok=False, erro="Esse link não parece ser do YouTube."), 400
    limpar_tarefas_antigas()
    ativos = sum(1 for t in tarefas.values() if t["etapa"] not in ("pronto", "erro"))
    if ativos >= MAX_DOWNLOADS_SIMULTANEOS:
        return jsonify(ok=False, erro="Já tem downloads demais em andamento. Espere um terminar."), 429
    id_tarefa = uuid.uuid4().hex
    tarefas[id_tarefa] = {"etapa": "iniciando", "porcentagem": 0, "criado": time.time()}
    threading.Thread(target=executar, args=(id_tarefa, url), daemon=True).start()
    return jsonify(ok=True, id=id_tarefa)


@app.get("/api/progresso/<id_tarefa>")
def api_progresso(id_tarefa):
    tarefa = tarefas.get(id_tarefa)
    if tarefa is None:
        return jsonify(etapa="erro", erro="O download foi perdido. O servidor pode ter sido reiniciado."), 404
    return jsonify({k: v for k, v in tarefa.items() if k != "criado"})


@app.get("/api/musicas")
def api_musicas():
    PASTA_DESTINO.mkdir(exist_ok=True)
    arquivos = sorted(PASTA_DESTINO.glob("*.mp3"), key=lambda p: p.stat().st_mtime, reverse=True)
    return jsonify([{"arquivo": p.name, "titulo": p.stem} for p in arquivos])


@app.get("/musicas/<path:nome>")
def arquivo(nome):
    # ?ouvir=1 toca no navegador; sem ele, força o download
    mp3 = mp3_da_biblioteca(nome)
    if mp3 is None:
        abort(404)
    return send_from_directory(PASTA_DESTINO, mp3.name, as_attachment="ouvir" not in request.args)


@app.get("/capas/<path:nome>")
def capa(nome):
    """Extrai (uma vez) a capa embutida no MP3 e a devolve como JPG."""
    mp3 = mp3_da_biblioteca(nome)
    if mp3 is None:
        abort(404)
    PASTA_CAPAS.mkdir(exist_ok=True)
    jpg = PASTA_CAPAS / (mp3.stem + ".jpg")
    if not jpg.exists() and shutil.which("ffmpeg"):
        subprocess.run(
            ["ffmpeg", "-y", "-loglevel", "error", "-i", str(mp3), "-an", "-frames:v", "1", str(jpg)],
            check=False,
        )
    if not jpg.exists():
        abort(404)
    return send_from_directory(PASTA_CAPAS, jpg.name)


if __name__ == "__main__":
    porta = int(os.environ.get("BRISA_PORTA", "5000"))
    print(f"Brisa rodando em http://127.0.0.1:{porta}")
    # Só escuta no próprio computador: não exponha na rede (host="0.0.0.0")
    app.run(host="127.0.0.1", port=porta, debug=False, threaded=True)
