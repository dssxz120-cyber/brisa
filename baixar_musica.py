"""Baixa o áudio de vídeos do YouTube e converte para MP3.

Uso:
    python baixar_musica.py                 # modo interativo (cola os links)
    python baixar_musica.py <link> [<link>] # baixa os links passados
"""

import os
import shutil
import sys
from pathlib import Path
from urllib.parse import urlsplit

try:
    import yt_dlp
except ImportError:
    sys.exit("Dependência ausente. Rode: pip install -r requirements.txt")

# No executável (PyInstaller), as músicas ficam ao lado do .exe, não na pasta temporária
EMPACOTADO = getattr(sys, "frozen", False)
PASTA_PROGRAMA = Path(sys.executable).parent if EMPACOTADO else Path(__file__).parent

# Pasta das músicas: pode ser trocada com a variável de ambiente BRISA_PASTA
PASTA_DESTINO = Path(os.environ.get("BRISA_PASTA") or PASTA_PROGRAMA / "musicas").resolve()

INSTRUCOES_FFMPEG = (
    "O ffmpeg não está instalado. Instale e abra a Brisa de novo — "
    "Windows: winget install Gyan.FFmpeg · macOS: brew install ffmpeg · Linux: sudo apt install ffmpeg"
)


def ffmpeg_disponivel() -> bool:
    return shutil.which("ffmpeg") is not None
QUALIDADE_KBPS = "320"

HOSTS_YOUTUBE = {"youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com", "youtu.be"}
TAMANHO_MAXIMO_LINK = 2048


def link_valido(url: str) -> bool:
    """Aceita só endereços http(s) cujo domínio seja exatamente um dos do YouTube."""
    url = url.strip()
    if not url or len(url) > TAMANHO_MAXIMO_LINK or any(c.isspace() for c in url):
        return False
    if "://" not in url:
        url = "https://" + url
    try:
        partes = urlsplit(url)
        porta = partes.port  # levanta ValueError se a porta for inválida
    except ValueError:
        return False
    return (
        partes.scheme in ("http", "https")
        and (partes.hostname or "") in HOSTS_YOUTUBE
        and partes.username is None   # bloqueia truques como youtube.com@outro-site
        and porta in (None, 80, 443)
        and len(partes.path) > 1
    )


def progresso(d: dict) -> None:
    if d["status"] == "downloading":
        pct = d.get("_percent_str", "").strip()
        vel = d.get("_speed_str", "").strip()
        print(f"\r  Baixando... {pct} ({vel})   ", end="", flush=True)
    elif d["status"] == "finished":
        print("\r  Download concluído. Convertendo para MP3...          ")


def baixar(url: str, mostrar_progresso: bool = True, ao_progredir=None) -> dict | None:
    """Baixa o áudio e retorna {'titulo', 'autor', 'arquivo'} ou None em caso de erro.

    `ao_progredir(etapa, porcentagem)` é chamado durante o download, se informado.
    """
    PASTA_DESTINO.mkdir(exist_ok=True)

    def avisar(d: dict) -> None:
        if d["status"] == "downloading":
            total = d.get("total_bytes") or d.get("total_bytes_estimate") or 0
            pct = d.get("downloaded_bytes", 0) / total * 100 if total else 0
            ao_progredir("baixando", round(pct, 1))
        elif d["status"] == "finished":
            ao_progredir("convertendo", 100)

    ganchos = []
    if mostrar_progresso:
        ganchos.append(progresso)
    if ao_progredir:
        ganchos.append(avisar)

    opcoes = {
        "format": "bestaudio/best",
        "outtmpl": str(PASTA_DESTINO / "%(title)s.%(ext)s"),
        "noplaylist": True,
        "quiet": True,
        "no_warnings": True,
        "noprogress": True,
        "progress_hooks": ganchos,
        "postprocessors": [
            {
                "key": "FFmpegExtractAudio",
                "preferredcodec": "mp3",
                "preferredquality": QUALIDADE_KBPS,
            },
            {"key": "FFmpegMetadata"},
            {"key": "EmbedThumbnail"},
        ],
        "writethumbnail": True,
    }
    try:
        with yt_dlp.YoutubeDL(opcoes) as ydl:
            # Uma única consulta: busca os dados e já baixa
            info = ydl.extract_info(url, download=True)
            # Caminho final, depois da conversão para MP3
            baixados = info.get("requested_downloads") or [{}]
            caminho = baixados[0].get("filepath") or ydl.prepare_filename(info)
            arquivo = Path(caminho).with_suffix(".mp3")
        print(f"\n> {info.get('title')}  [{info.get('uploader')}]")
        print(f"  OK! Salvo em: {PASTA_DESTINO}")
        return {
            "titulo": info.get("title"),
            "autor": info.get("uploader"),
            "arquivo": arquivo.name,
        }
    except yt_dlp.utils.DownloadError as e:
        print(f"\n  Erro ao baixar: {e}")
        return None


def main() -> None:
    if not ffmpeg_disponivel():
        sys.exit(INSTRUCOES_FFMPEG)
    links = sys.argv[1:]
    if links:
        for url in links:
            if link_valido(url):
                baixar(url)
            else:
                print(f"Link inválido (não é do YouTube): {url}")
        return

    print("=== Baixador de músicas do YouTube (MP3) ===")
    print("Cole o link e aperte Enter. Digite 'sair' para encerrar.\n")
    while True:
        try:
            url = input("Link: ").strip()
        except (EOFError, KeyboardInterrupt):
            break
        if url.lower() in ("sair", "exit", "q"):
            break
        if not url:
            continue
        if not link_valido(url):
            print("  Isso não parece um link do YouTube. Tente de novo.\n")
            continue
        baixar(url)
        print()


if __name__ == "__main__":
    main()
