const $ = (sel) => document.querySelector(sel);
const LINK_YOUTUBE = /^(https?:\/\/)?(www\.|m\.|music\.)?(youtube\.com|youtu\.be)\/.+/i;
const TITULO_ORIGINAL = document.title;

// encodeURIComponent não codifica ' ( ) — e eles quebram url('...') no CSS
const codificar = (nome) => encodeURIComponent(nome).replace(/['()]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase());

/* ---------- Comandos de instalação ---------- */
const comandos = {
  win: ["winget install Gyan.FFmpeg", "pip install -r requirements.txt", "python app.py"],
  mac: ["brew install ffmpeg", "pip3 install -r requirements.txt", "python3 app.py"],
  linux: ["sudo apt install ffmpeg", "pip3 install -r requirements.txt", "python3 app.py"],
};
let sistema = "win";

function mostrarComandos(os) {
  sistema = os;
  $("#comando").innerHTML = comandos[os].map((c) => `<span class="p">$ </span>${c}`).join("\n");
  document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("ativo", t.dataset.os === os));
}
document.querySelectorAll(".tab").forEach((t) => t.addEventListener("click", () => mostrarComandos(t.dataset.os)));
mostrarComandos("win");

$("#copiar").addEventListener("click", async (e) => {
  try {
    await navigator.clipboard.writeText(comandos[sistema].join("\n"));
    e.target.textContent = "Copiado";
  } catch {
    e.target.textContent = "Não foi possível copiar";
  }
  setTimeout(() => (e.target.textContent = "Copiar"), 1500);
});

/* ---------- Foto do topo de acordo com o horário ---------- */
const CREDITOS = {
  amanhecer: ["Foto: George Chernilevsky, domínio público", "https://commons.wikimedia.org/wiki/File:Desenka_meadow_2019_G2.jpg"],
  dia: ["Foto: Ferdinand, CC BY 3.0", "https://commons.wikimedia.org/wiki/File:Colors_Of_Spring_(109621705).jpeg"],
  entardecer: ["Foto: Mahesh Gudladona, CC BY 3.0", "https://commons.wikimedia.org/wiki/File:Fields_Golden_Hour_(95316529).jpeg"],
  noite: ["Foto: Santa Monica Mountains NRA, domínio público", "https://commons.wikimedia.org/wiki/File:Night_Sky_-_Boney_Mountain_%26_Milky_Way_(11074300594).jpg"],
};

function periodoAtual() {
  const h = new Date().getHours();
  if (h >= 5 && h < 8) return "amanhecer";
  if (h >= 8 && h < 17) return "dia";
  if (h >= 17 && h < 19) return "entardecer";
  return "noite";
}

let temaEscolhido = localStorage.getItem("brisa-tema") || "auto"; // auto | claro | escuro
let periodoMostrado = null;

function atualizarPeriodo() {
  const p = periodoAtual();
  if (p !== periodoMostrado) {
    periodoMostrado = p;
    document.querySelectorAll(".foto").forEach((f) => f.classList.toggle("ativa", f.dataset.periodo === p));
    const [texto, link] = CREDITOS[p];
    $("#credito").textContent = texto;
    $("#credito").href = link;
  }
  const escuro = temaEscolhido === "escuro" || (temaEscolhido === "auto" && p === "noite");
  document.body.classList.toggle("escuro", escuro);
}

const NOMES_TEMA = { auto: "Auto", claro: "Claro", escuro: "Escuro" };
$("#tema").textContent = NOMES_TEMA[temaEscolhido];
$("#tema").addEventListener("click", () => {
  const ordem = ["auto", "claro", "escuro"];
  temaEscolhido = ordem[(ordem.indexOf(temaEscolhido) + 1) % ordem.length];
  localStorage.setItem("brisa-tema", temaEscolhido);
  $("#tema").textContent = NOMES_TEMA[temaEscolhido];
  atualizarPeriodo();
});
atualizarPeriodo();
setInterval(atualizarPeriodo, 60_000);

/* ---------- Vidro: menu escuro sobre a foto, claro sobre a página ---------- */
const nav = $("#nav");
new IntersectionObserver(
  ([entrada]) => nav.classList.toggle("sobre-foto", entrada.isIntersecting),
  { rootMargin: "-60px 0px 0px 0px", threshold: 0 }
).observe($(".hero"));

// Reflexo que acompanha o ponteiro em qualquer superfície de vidro
document.addEventListener("pointermove", (e) => {
  const vidro = e.target.closest?.(".vidro");
  if (!vidro) return;
  const r = vidro.getBoundingClientRect();
  vidro.style.setProperty("--mx", `${e.clientX - r.left}px`);
  vidro.style.setProperty("--my", `${e.clientY - r.top}px`);
});

/* ---------- Favicon com progresso ---------- */
const canvas = document.createElement("canvas");
canvas.width = canvas.height = 64;
const ctx = canvas.getContext("2d");

function desenharFavicon(porcentagem = null) {
  ctx.clearRect(0, 0, 64, 64);
  ctx.fillStyle = "#1f1e1b";
  ctx.beginPath(); ctx.arc(32, 32, 24, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#a4532f";
  ctx.beginPath(); ctx.arc(32, 32, 9, 0, Math.PI * 2); ctx.fill();
  if (porcentagem !== null) {
    ctx.strokeStyle = "#a4532f";
    ctx.lineWidth = 6;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.arc(32, 32, 29, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * porcentagem) / 100);
    ctx.stroke();
  }
  $("#favicon").href = canvas.toDataURL("image/png");
}
desenharFavicon();

let avisoPendente = false;
document.addEventListener("visibilitychange", () => {
  if (!document.hidden && avisoPendente) {
    avisoPendente = false;
    document.title = TITULO_ORIGINAL;
    desenharFavicon();
  }
});

/* ---------- Sons (gerados na hora com a Web Audio API) ---------- */
let somLigado = localStorage.getItem("brisa-som") !== "desligado";
let audioCtx = null;
let saidaSom = null;

function mostrarSom() {
  $("#som").textContent = somLigado ? "Som" : "Mudo";
  $("#som").setAttribute("aria-pressed", String(somLigado));
  $("#som").title = somLigado ? "Sons ligados" : "Sons desligados";
}
$("#som").addEventListener("click", () => {
  somLigado = !somLigado;
  localStorage.setItem("brisa-som", somLigado ? "ligado" : "desligado");
  mostrarSom();
  if (somLigado) { prepararSom(); tom(880, 0, 0.12, 0.12); }
});
mostrarSom();

// Precisa ser chamado durante um clique/tecla: o navegador só libera áudio assim
function prepararSom() {
  if (!somLigado) return;
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    // eco curto que dá a sensação de "brilho" no ar
    saidaSom = audioCtx.createGain();
    saidaSom.gain.value = 0.22;
    const eco = audioCtx.createDelay();
    eco.delayTime.value = 0.13;
    const retorno = audioCtx.createGain();
    retorno.gain.value = 0.28;
    const filtro = audioCtx.createBiquadFilter();
    filtro.type = "lowpass";
    filtro.frequency.value = 4200;
    saidaSom.connect(audioCtx.destination);
    saidaSom.connect(eco);
    eco.connect(filtro);
    filtro.connect(retorno);
    retorno.connect(eco);
    retorno.connect(audioCtx.destination);
  }
  if (audioCtx.state === "suspended") audioCtx.resume();
}

// Uma nota com timbre de sino: fundamental + harmônico, ataque rápido e decaimento suave
function tom(freq, quando, duracao, volume = 0.3) {
  if (!somLigado || !audioCtx) return;
  const t = audioCtx.currentTime + quando;
  const envelope = audioCtx.createGain();
  envelope.gain.setValueAtTime(0.0001, t);
  envelope.gain.exponentialRampToValueAtTime(volume, t + 0.008);
  envelope.gain.exponentialRampToValueAtTime(0.0001, t + duracao);
  envelope.connect(saidaSom);

  [[1, "sine", 1], [2, "sine", 0.35], [3.01, "triangle", 0.08]].forEach(([mult, tipo, ganho]) => {
    const osc = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    osc.type = tipo;
    osc.frequency.setValueAtTime(freq * mult, t);
    g.gain.value = ganho;
    osc.connect(g);
    g.connect(envelope);
    osc.start(t);
    osc.stop(t + duracao + 0.05);
  });
}

const sons = {
  // toque curto e leve quando o download começa
  inicio: () => { tom(660, 0, 0.18, 0.12); tom(990, 0.06, 0.22, 0.08); },
  // arpejo maior subindo (Dó-Mi-Sol-Dó) + brilho agudo: o "plim" de conquista
  pronto: () => {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tom(f, i * 0.075, 0.7, 0.26));
    tom(1318.5, 0.33, 0.9, 0.14);
    tom(1568, 0.4, 1.1, 0.1);
    tom(2093, 0.47, 1.2, 0.06);
  },
  // duas notas descendo, suaves, sem soar como alarme
  erro: () => { tom(392, 0, 0.35, 0.16); tom(311.1, 0.16, 0.5, 0.14); },
};

/* ---------- Download ---------- */
const form = $("#form");
const estado = $("#estado");
const status = $("#status");
const mascote = $("#mascote");
const botao = $("#enviar");
let baixando = false;

// humor do Vini: procurando | convertendo | pronto | erro | null (sem mascote)
function aviso(tipo, html, humor = null) {
  estado.hidden = false;
  status.classList.toggle("erro", tipo === "erro");
  status.innerHTML = html;
  estado.classList.toggle("sem-mascote", !humor);
  if (humor && mascote.dataset.humor !== humor) {
    mascote.dataset.humor = humor;
    // reinicia as animações de entrada ao trocar de humor
    mascote.style.animation = "none";
    void mascote.getBoundingClientRect();
    mascote.style.animation = "";
  }
}

function escapar(texto) {
  const s = document.createElement("span");
  s.textContent = texto;
  return s.innerHTML;
}

// Lê JSON com segurança: se o servidor responder HTML ou cair, vira um erro legível
async function lerJson(resp) {
  try {
    return await resp.json();
  } catch {
    throw new Error("O servidor não respondeu como esperado. Ele ainda está rodando?");
  }
}

async function acompanhar(id) {
  while (true) {
    await new Promise((r) => setTimeout(r, 500));
    let resp;
    try {
      resp = await fetch(`/api/progresso/${id}`);
    } catch {
      throw new Error("Perdi a conexão com o servidor.");
    }
    const tarefa = await lerJson(resp);
    if (tarefa.etapa === "erro") throw new Error(tarefa.erro);
    if (tarefa.etapa === "pronto") return tarefa.resultado;

    const pct = Math.round(tarefa.porcentagem || 0);
    const texto = { iniciando: "Procurando o vídeo…", convertendo: "Convertendo para MP3…" }[tarefa.etapa] || `Baixando ${pct}%`;
    const humor = tarefa.etapa === "iniciando" ? "procurando" : "convertendo";
    aviso("", `${texto}<div class="progresso"><span style="width:${pct}%"></span></div>`, humor);
    desenharFavicon(pct);
    document.title = `${tarefa.etapa === "convertendo" ? "Convertendo" : pct + "%"} · ${TITULO_ORIGINAL}`;
  }
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (baixando) return;
  baixando = true;
  botao.disabled = true;
  prepararSom();
  sons.inicio();
  aviso("", "Procurando o vídeo…", "procurando");

  try {
    let resp;
    try {
      resp = await fetch("/api/baixar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: $("#url").value.trim() }),
      });
    } catch {
      throw new Error("Não consegui falar com o servidor. Ele está rodando?");
    }
    const dados = await lerJson(resp);
    if (!dados.ok) throw new Error(dados.erro);

    const musica = await acompanhar(dados.id);
    const link = `/musicas/${codificar(musica.arquivo)}`;
    aviso("", `<strong>${escapar(musica.titulo)}</strong> está pronta. <a href="${link}">Salvar de novo</a>`, "pronto");
    sons.pronto();
    window.location.href = link;
    $("#url").value = "";
    carregarBiblioteca();

    if (document.hidden) {
      avisoPendente = true;
      document.title = `Pronto: ${musica.titulo}`;
      desenharFavicon(100);
    } else {
      document.title = TITULO_ORIGINAL;
      desenharFavicon();
    }
  } catch (err) {
    aviso("erro", escapar(err.message || "Não foi possível baixar."), "erro");
    sons.erro();
    document.title = TITULO_ORIGINAL;
    desenharFavicon();
  } finally {
    baixando = false;
    botao.disabled = false;
  }
});

function enviarLink(texto) {
  const url = (texto || "").trim().split(/\s+/)[0];
  if (!LINK_YOUTUBE.test(url)) return false;
  if (baixando) {
    aviso("", "Espere o download atual terminar.");
    return true;
  }
  $("#url").value = url;
  window.scrollTo({ top: 0, behavior: "smooth" });
  form.requestSubmit();
  return true;
}

// Ctrl+V em qualquer lugar da página
document.addEventListener("paste", (e) => {
  if (e.target.closest?.("input, textarea")) return;
  if (enviarLink(e.clipboardData.getData("text"))) e.preventDefault();
});

// Arrastar o link para a página (só reage a links vindos de fora)
let arrastando = 0;
let arrasteInterno = false;
const soltar = $("#soltar");
const temLink = (e) => !arrasteInterno && [...e.dataTransfer.types].some((t) => t === "text/uri-list" || t === "text/plain");

document.addEventListener("dragstart", () => (arrasteInterno = true));
document.addEventListener("dragend", () => (arrasteInterno = false));
window.addEventListener("dragenter", (e) => {
  if (!temLink(e)) return;
  e.preventDefault();
  arrastando++;
  soltar.hidden = false;
});
window.addEventListener("dragover", (e) => { if (temLink(e)) e.preventDefault(); });
window.addEventListener("dragleave", () => {
  if (--arrastando <= 0) { arrastando = 0; soltar.hidden = true; }
});
window.addEventListener("drop", (e) => {
  if (!temLink(e)) return;
  e.preventDefault();
  arrastando = 0;
  soltar.hidden = true;
  const texto = e.dataTransfer.getData("text/uri-list") || e.dataTransfer.getData("text/plain");
  if (!enviarLink(texto)) aviso("erro", "Esse link não parece ser do YouTube.");
});

/* ---------- Player ---------- */
const audio = new Audio();
const player = $("#player");
const barra = $("#player-barra");
let arquivoAtual = null;
let arrastandoBarra = false;

const formatar = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

function marcarAlbum() {
  document.querySelectorAll(".album").forEach((a) => {
    const atual = a.dataset.arquivo === arquivoAtual;
    a.classList.toggle("tocando", atual);
    a.classList.toggle("pausado", atual && audio.paused);
    a.querySelector(".album-arte").setAttribute("aria-label", `${atual && !audio.paused ? "Pausar" : "Tocar"} ${a.dataset.titulo}`);
  });
  $("#player-botao").textContent = audio.paused ? "Tocar" : "Pausar";
}

function reproduzir() {
  audio.play().catch(() => {
    aviso("erro", "O navegador bloqueou o som. Clique em Tocar no player.");
    marcarAlbum();
  });
}

function tocar(musica) {
  if (arquivoAtual === musica.arquivo) {
    audio.paused ? reproduzir() : audio.pause();
    return;
  }
  arquivoAtual = musica.arquivo;
  audio.src = `/musicas/${codificar(musica.arquivo)}?ouvir=1`;
  $("#player-capa").src = `/capas/${codificar(musica.arquivo)}`;
  $("#player-titulo").textContent = musica.titulo;
  barra.value = 0;
  $("#player-tempo").textContent = "0:00";
  player.hidden = false;
  reproduzir();
  marcarAlbum();
}

function fecharPlayer() {
  audio.pause();
  audio.removeAttribute("src");
  audio.load();
  arquivoAtual = null;
  player.hidden = true;
  marcarAlbum();
}

audio.addEventListener("play", marcarAlbum);
audio.addEventListener("pause", marcarAlbum);
audio.addEventListener("ended", marcarAlbum);
audio.addEventListener("error", () => {
  if (!arquivoAtual) return;
  aviso("erro", "Não foi possível tocar esse arquivo.");
  fecharPlayer();
});
audio.addEventListener("timeupdate", () => {
  if (!audio.duration || arrastandoBarra) return;
  barra.value = (audio.currentTime / audio.duration) * 100;
  $("#player-tempo").textContent = `${formatar(audio.currentTime)} / ${formatar(audio.duration)}`;
});
barra.addEventListener("pointerdown", () => (arrastandoBarra = true));
barra.addEventListener("input", () => {
  if (audio.duration) $("#player-tempo").textContent = `${formatar((barra.value / 100) * audio.duration)} / ${formatar(audio.duration)}`;
});
barra.addEventListener("change", () => {
  if (audio.duration) audio.currentTime = (barra.value / 100) * audio.duration;
  arrastandoBarra = false;
});
$("#player-botao").addEventListener("click", () => (audio.paused ? reproduzir() : audio.pause()));
$("#player-fechar").addEventListener("click", fecharPlayer);

/* ---------- Biblioteca ---------- */
const ICONES = `
  <svg class="icone-tocar" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2.5v11l9.5-5.5z"/></svg>
  <svg class="icone-pausa" viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 2.5h3v11h-3zM9.5 2.5h3v11h-3z"/></svg>`;

async function carregarBiblioteca() {
  let musicas;
  try {
    musicas = await lerJson(await fetch("/api/musicas"));
  } catch {
    $("#vazio").textContent = "Não foi possível carregar a biblioteca.";
    $("#vazio").hidden = false;
    return;
  }
  const capas = $("#capas");
  capas.innerHTML = "";
  $("#vazio").textContent = "Nenhuma música ainda. As que você baixar aparecem aqui.";
  $("#vazio").hidden = musicas.length > 0;
  $("#contagem").textContent = musicas.length ? `${musicas.length} ${musicas.length === 1 ? "música" : "músicas"}` : "";

  for (const m of musicas) {
    const nome = codificar(m.arquivo);
    const album = document.createElement("div");
    album.className = "album";
    album.dataset.arquivo = m.arquivo;
    album.dataset.titulo = m.titulo;
    album.innerHTML = `
      <button class="album-arte" type="button">
        <span class="vinil" style="--capa:url('/capas/${nome}')"></span>
        <span class="capa" style="background-image:url('/capas/${nome}')"></span>
        <span class="tocar vidro sobre-foto">${ICONES}</span>
      </button>
      <h3></h3>
      <a href="/musicas/${nome}">Baixar</a>`;
    album.querySelector("h3").textContent = m.titulo;
    album.querySelector(".album-arte").addEventListener("click", () => tocar(m));
    capas.appendChild(album);
  }
  marcarAlbum();
}
carregarBiblioteca();
