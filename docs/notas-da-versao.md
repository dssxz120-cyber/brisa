Baixe músicas do YouTube em MP3, com capa e nome do artista, por uma página que roda no seu computador. Não precisa instalar Python.

## Download

| Sistema | Arquivo |
|---|---|
| Windows 10/11 (64 bits) | `brisa-windows-x64.exe` |
| Linux (64 bits) | `brisa-linux-x64.tar.gz` |
| macOS (Apple Silicon: M1, M2, M3…) | `brisa-macos-arm64.tar.gz` |

## Antes de abrir: instale o ffmpeg

A Brisa usa o ffmpeg para converter o áudio. Instale uma vez:

- **Windows:** abra o Terminal e rode `winget install Gyan.FFmpeg`
- **macOS:** `brew install ffmpeg` (precisa do [Homebrew](https://brew.sh))
- **Linux:** `sudo apt install ffmpeg` (ou o gerenciador de pacotes da sua distribuição)

## Como abrir

**Windows:** dê dois cliques em `brisa-windows-x64.exe`. Se aparecer "O Windows protegeu o computador", clique em **Mais informações → Executar assim mesmo** (o aviso aparece porque o programa não tem assinatura digital paga).

**Linux:**
```bash
tar -xzf brisa-linux-x64.tar.gz
./brisa
```

**macOS:**
```bash
tar -xzf brisa-macos-arm64.tar.gz
xattr -d com.apple.quarantine brisa   # libera o programa baixado da internet
./brisa
```

O navegador abre sozinho em **http://127.0.0.1:5000**. As músicas ficam na pasta `musicas`, ao lado do programa. Para fechar, feche a janela do terminal.

## Verificar o download (opcional)

O arquivo `SHA256SUMS.txt` traz a soma de verificação de cada executável. Eles são gerados automaticamente pelo GitHub Actions a partir do código deste repositório.

## Uso responsável

Baixe apenas conteúdo que você tem direito de baixar e respeite os Termos de Serviço do YouTube e os direitos dos artistas.
