// ======= DOM =======
const messagesEl = document.getElementById('messages');
const inputEl     = document.getElementById('input');
const sendBtn     = document.getElementById('sendBtn');
const welcomeEl   = document.getElementById('welcome');

// Model selector
const modelBtn    = document.getElementById('modelSelector');
const modelDropdown = document.getElementById('modelDropdown');
const currentModelName = document.getElementById('currentModelName');

// ======= Config (NO tocar el runner) =======
window.AGENT_RUNNER_URL = localStorage.getItem("AGENT_RUNNER_URL") || "https://agent-runner-tpcc.onrender.com";

// ======= State =======
let agentSessionId = null;
let currentModel = 'gpt-4o-mini'; // default
let isAgentMode  = false;

// ======= Utils UI =======
function addTextMsg(role, html){
  const div = document.createElement('div');
  div.className = `msg ${role}`;
  div.innerHTML = html;
  messagesEl.appendChild(div);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  welcomeEl.style.display = 'none';
  return div;
}
function autosize(){
  inputEl.style.height = 'auto';
  inputEl.style.height = (inputEl.scrollHeight) + 'px';
}
function setSendEnabled(){
  const hasText = !!inputEl.value.trim();
  sendBtn.disabled = !hasText;
  sendBtn.classList.toggle('enabled', hasText);
}
inputEl.addEventListener('input', ()=>{ autosize(); setSendEnabled(); });
autosize(); setSendEnabled();

// Dropdown modelos
modelBtn.addEventListener('click', ()=>{
  const open = modelDropdown.classList.toggle('hidden');
  modelBtn.setAttribute('aria-expanded', (!open).toString());
});
modelDropdown.addEventListener('click', (e)=>{
  const btn = e.target.closest('.dropdown-item'); if(!btn) return;
  const m = btn.getAttribute('data-model');
  if(!m) return;
  currentModel = m;
  isAgentMode = (m === 'agent');
  currentModelName.textContent = btn.textContent.replace('🧑‍💻 ','');
  modelDropdown.classList.add('hidden');
});

// Cerrar dropdown al click fuera
document.addEventListener('click', (e)=>{
  if (!modelBtn.contains(e.target) && !modelDropdown.contains(e.target)){
    modelDropdown.classList.add('hidden');
  }
});

// ======= Clasificador simple de intención =======
// Detecta si el texto pide acciones para el agente.
function isAgentInstruction(text){
  const t = text.toLowerCase();
  const verbs = [
    'entra','entrar','abrí','abre','abrir','andá','ir a','ve a',
    'busca','buscar','investiga','navega','navegar',
    'crea','crear','diseña','diseñar','hace','haz','hacer',
    'abre canva','canva','plantillas','descarga','rellena','completa',
    'clic','click','escribe en','pegá','pega'
  ];
  return verbs.some(v => t.includes(v));
}

// ======= Backend chat normal =======
async function askGeneric(text){
  addTextMsg('user', text);
  try{
    const res = await fetch('/ask', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body:JSON.stringify({ message:text, model: currentModel })
    });
    const data = await res.json();
    addTextMsg('assistant', data.reply || '(sin respuesta)');
  }catch(err){
    addTextMsg('assistant', 'Error al consultar el modelo.');
  }
}

// ======= Tarjeta “En Directo” (marco azul) =======
function makeLiveCard(){
  const wrap = document.createElement('div');
  wrap.className = 'msg assistant';

  wrap.innerHTML = `
    <div class="agent-card">
      <div class="agent-frame-wrap">
        <div class="agent-tabbar">
          <img class="favicon" alt="favicon" />
          <span class="title">Nueva pestaña…</span>
        </div>
        <div class="agent-viewport" style="aspect-ratio: 16 / 9;">
          <img class="frame" alt="pantalla del agente"/>
        </div>
      </div>
      <div class="agent-meta"></div>
    </div>
  `;
  messagesEl.appendChild(wrap);
  messagesEl.scrollTop = messagesEl.scrollHeight;

  const frameEl   = wrap.querySelector('.frame');
  const viewEl    = wrap.querySelector('.agent-viewport');
  const titleEl   = wrap.querySelector('.agent-tabbar .title');
  const favEl     = wrap.querySelector('.agent-tabbar .favicon');

  // 1) Ajustar el aspect-ratio EXACTO al del frame real
  function lockAspectFromImage(){
    // al cargar el primer frame, usamos su tamaño real
    const w = frameEl.naturalWidth || 1280;
    const h = frameEl.naturalHeight || 720;
    viewEl.style.aspectRatio = `${w} / ${h}`;
  }
  frameEl.addEventListener('load', lockAspectFromImage);

  // 2) Polling de frame + status cada 300ms
  const state = { timer: null };
  async function startStream(){
    if(state.timer) clearInterval(state.timer);
    state.timer = setInterval(async ()=>{
      if(!agentSessionId) return;
      // refrescar imagen
      frameEl.src = `${window.AGENT_RUNNER_URL}/api/session/${agentSessionId}/frame?ts=${Date.now()}`;
      // pedir status para título y favicon
      try{
        const s = await fetch(`${window.AGENT_RUNNER_URL}/api/session/${agentSessionId}/status`);
        const d = await s.json();
        if(d?.ok){
          // título de la página si lo expone el runner
          if(d.status?.title) titleEl.textContent = d.status.title;
          // favicon: si no viene, inferimos /favicon.ico del host actual
          if(d.status?.favicon){
            favEl.src = d.status.favicon;
          }else if(d.status?.url){
            try{
              const u = new URL(d.status.url);
              favEl.src = `${u.origin}/favicon.ico`;
            }catch{}
          }
        }
      }catch{}
    }, 300);
  }

  return { startStream };
}



// ======= Agent session helpers =======
async function ensureAgentSession(){
  if(agentSessionId) return agentSessionId;
  const r = await fetch(`${window.AGENT_RUNNER_URL}/api/session/new`, { method:'POST' });
  const d = await r.json();
  if(!d.ok) throw new Error(d.error || 'No se pudo crear sesión');
  agentSessionId = d.sessionId;
  return agentSessionId;
}

// ======= Envío =======
sendBtn.addEventListener('click', async ()=>{
  const text = inputEl.value.trim(); if(!text) return;
  inputEl.value = ''; autosize(); setSendEnabled();

  // Decidir modo: selector explícito o clasificador automático
  const useAgent = (currentModel === 'agent') || (isAgentInstruction(text) && currentModel !== 'gpt-3.5-turbo');

  if(!useAgent){
    return askGeneric(text);
  }

  // Agente
  addTextMsg('user', text);
  const live = makeLiveCard();
  live.setStatus('Conectando…');

  try{
    await ensureAgentSession();
    live.setStatus('En vivo');
    live.startStream();

    live.setTip('Procesando instrucción…');
    const res = await fetch(`${window.AGENT_RUNNER_URL}/api/agent/task`, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body:JSON.stringify({ sessionId: agentSessionId, instruction: text })
    });
    const data = await res.json();
    if(!data.ok){
      live.setStatus('Error');
      live.setTip('No se pudo ejecutar la tarea.');
      addTextMsg('assistant', `Error del agente: ${data.error || 'desconocido'}`);
      return;
    }
    live.setTip('Tarea enviada. Mirá el visor.');
    addTextMsg('assistant', 'Claro, ahí lo hago. Abajo podés ver lo que voy haciendo en tiempo real.');
  }catch(err){
    live.setStatus('Error');
    live.setTip('No se pudo iniciar el agente.');
    addTextMsg('assistant', `No se pudo iniciar el agente: ${String(err)}`);
  }
});

// Enter para enviar
inputEl.addEventListener('keydown', (e)=>{
  if(e.key === 'Enter' && !e.shiftKey){
    e.preventDefault(); sendBtn.click();
  }
});

// ====== VOZ → TEXTO con MediaRecorder (compatible Safari/Chrome/Firefox) ======
const micBtn   = document.getElementById("micBtn");

// Modal no mic
const noMicModal  = document.getElementById("noMicModal");
const noMicClose  = document.getElementById("noMicClose");
noMicClose?.addEventListener("click", () => noMicModal.classList.add("hidden"));

let mediaRecorder = null;
let mediaStream   = null;
let chunks        = [];
let isRecording   = false;

// Selección de MIME cross-browser (Safari prefiere MP4, Chrome WebM)
function pickBestMime() {
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4", // Safari iOS/macOS
    "audio/ogg;codecs=opus",
    "audio/ogg"
  ];
  for (const type of candidates) {
    if (MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(type)) return type;
  }
  return ""; // dejar que el browser elija
}

// Verificar existencia de micrófono
async function hasMicrophone() {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.some(d => d.kind === "audioinput");
  } catch {
    return false;
  }
}

function showNoMicModal() {
  noMicModal?.classList.remove("hidden");
}

// Iniciar grabación
async function startRecording() {
  const okMic = await hasMicrophone();
  if (!okMic) { showNoMicModal(); return; }

  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true }
    });
  } catch (err) {
    showNoMicModal();
    return;
  }

  chunks = [];
  const mimeType = pickBestMime();
  try {
    mediaRecorder = new MediaRecorder(mediaStream, mimeType ? { mimeType } : undefined);
  } catch (e) {
    // fallback sin mimeType
    mediaRecorder = new MediaRecorder(mediaStream);
  }

  mediaRecorder.ondataavailable = (e) => { if (e.data?.size) chunks.push(e.data); };
  mediaRecorder.onstop = async () => {
    // Detener tracks
    mediaStream.getTracks().forEach(t => t.stop());
    mediaStream = null;

    // Blob final
    const chosenType = mediaRecorder.mimeType || "audio/webm";
    const ext = chosenType.includes("mp4") ? "m4a" :
                chosenType.includes("ogg") ? "ogg" : "webm";
    const blob = new Blob(chunks, { type: chosenType || "audio/webm" });
    await sendBlobToSTT(blob, ext);
  };

  mediaRecorder.start();
  isRecording = true;
  micBtn.classList.add("recording");
}

// Detener grabación
function stopRecording() {
  if (mediaRecorder && isRecording) {
    mediaRecorder.stop();
  }
  isRecording = false;
  micBtn.classList.remove("recording");
}

// Enviar al backend /stt y volcar texto en el input (NO auto-envía)
async function sendBlobToSTT(blob, ext) {
  try {
    const form = new FormData();
    form.append("audio", blob, `voice.${ext}`);

    const res = await fetch("/stt", {
      method: "POST",
      body: form
    });

    if (!res.ok) throw new Error("STT error");
    const data = await res.json(); // { text: "..." }
    if (data?.text) {
      inputEl.value = data.text;
      inputEl.dispatchEvent(new Event("input")); // habilita botón Enviar si aplica
    }
  } catch (err) {
    alert("No se pudo transcribir el audio. Probá de nuevo.");
  }
}

// Click del botón: un click inicia, otro click detiene
if (micBtn) {
  micBtn.addEventListener("click", async () => {
    // Soporte básico
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      showNoMicModal();
      return;
    }
    if (!isRecording) startRecording(); else stopRecording();
  });
}

document.getElementById("newChatBtn").addEventListener("click", () => {
  messagesEl.innerHTML = "";
  welcomeEl.style.display = "block";
  inputEl.value = "";
  inputEl.style.height = "auto";
  sendBtn.disabled = true;
  agentSessionId = null;
});

// ===== BOTONES CENTRALES DE MODO =====
const modeChatBtn  = document.getElementById("modeChatBtn");
const modeAgentBtn = document.getElementById("modeAgentBtn");
const underline    = document.querySelector(".mode-underline");

// función para mover la línea debajo del botón activo
function moveUnderline(btn) {
  const rect = btn.getBoundingClientRect();
  const parent = btn.parentElement.getBoundingClientRect();

  const btnCenter = rect.left - parent.left + rect.width / 2;
  const underlineWidth = underline.offsetWidth;

  // centrar
  underline.style.left = (btnCenter - underlineWidth / 2) + "px";
}


// === modo CHAT ===
modeChatBtn.addEventListener("click", () => {
  modeChatBtn.classList.add("active");
  modeAgentBtn.classList.remove("active");
  moveUnderline(modeChatBtn);

  // restaurar bienvenida original
  welcomeEl.style.display = "block";
  document.querySelector(".welcome-img").src = "static/images/chat-mode.png";

  // resetear chat
  messagesEl.innerHTML = "";
  agentSessionId = null;
  inputEl.value = "";
  sendBtn.disabled = true;
});

// === modo AGENTE ===
modeAgentBtn.addEventListener("click", () => {
  modeAgentBtn.classList.add("active");
  modeChatBtn.classList.remove("active");
  moveUnderline(modeAgentBtn);

  // mostrar imagen del agente en bienvenida
  welcomeEl.style.display = "block";
  document.querySelector(".welcome-img").src = "static/images/agent-mode.png";

  // nuevo chat igual que newChatBtn
  messagesEl.innerHTML = "";
  agentSessionId = null;
  inputEl.value = "";
  sendBtn.disabled = true;

  // activar modo agente
  currentModel = "agent";
  isAgentMode = true;
});

// posicion inicial al cargar
window.addEventListener("DOMContentLoaded", () => {
  moveUnderline(modeChatBtn);
});






