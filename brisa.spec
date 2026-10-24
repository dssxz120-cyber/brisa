# Configuração do PyInstaller para gerar o executável da Brisa.
# Uso: pyinstaller brisa.spec   (o resultado fica em dist/)

a = Analysis(
    ["app.py"],
    datas=[("templates", "templates"), ("static", "static")],
    hiddenimports=[],
    excludes=["tkinter", "unittest", "pydoc"],
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    name="brisa",
    console=True,  # a janela do terminal mostra o endereço e mantém o servidor aberto
    upx=False,
    strip=False,
)
