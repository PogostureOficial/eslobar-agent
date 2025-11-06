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
function makeLiveCard({tabTitle='Nueva pestaña…'}={}){
  const wrap = document.createElement('div');
  wrap.className = 'msg assistant';

  // Shell azul + interior
  wrap.innerHTML = `
    <div class="agent-shell">
      <div class="agent-inner">
        <div class="agent-top">
          <div class="agent-tab">${tabTitle}</div>
          <div class="spacer"></div>
          <div class="status" aria-live="polite">Conectando…</div>
        </div>

        <div class="agent-stage">
          <img class="frame" alt="pantalla del agente"/>
          <canvas class="agent-overlay"></canvas>
          <img class="agent-cursor" src="static/images/cursor.png" />
          <div class="agent-tip"></div>
        </div>

        <div class="agent-bottom">
          <div class="live-pill"><span class="live-dot"></span><strong>EN DIRECTO</strong></div>
          <div class="progress-bar"></div>
          <div class="url" style="opacity:.8;font-size:12px"></div>
        </div>

        <div class="quick-actions">
          <button data-q="canva">Créame un Canva sobre: </button>
          <button data-q="search">Busca información sobre: </button>
          <button data-q="open">Abrí la página: </button>
        </div>
      </div>
    </div>
  `;
  messagesEl.appendChild(wrap);
  messagesEl.scrollTop = messagesEl.scrollHeight;

  const frame   = wrap.querySelector('.frame');
  const overlay = wrap.querySelector('.agent-overlay');
  const cursor  = wrap.querySelector('.agent-cursor');
  const tip     = wrap.querySelector('.agent-tip');
  const status  = wrap.querySelector('.status');
  const urlEl   = wrap.querySelector('.url');

  // Ajuste del canvas
  function fit(){
    overlay.width  = overlay.clientWidth;
    overlay.height = overlay.clientHeight;
  }
  new ResizeObserver(fit).observe(overlay); fit();

  const state = { timer:null, last:{x:.5,y:.5}, anim:null };

  // Refresh del frame cada 300 ms
  async function startStream(){
    if(state.timer) clearInterval(state.timer);
    state.timer = setInterval(async ()=>{
      if(!agentSessionId) return;
      frame.src = `${window.AGENT_RUNNER_URL}/api/session/${agentSessionId}/frame?ts=${Date.now()}`;
      try{
        const s = await fetch(`${window.AGENT_RUNNER_URL}/api/session/${agentSessionId}/status`);
        const d = await s.json();
        if(d.ok){
          status.textContent = d.status.paused ? 'Pausado' : 'En vivo';
          urlEl.textContent  = d.status.url || '';
        }
      }catch{}
    }, 300);
  }

  function moveCursor(rx, ry, label){
    const lx = rx * overlay.clientWidth;
    const ly = ry * overlay.clientHeight;
    cursor.style.display = 'block';
    cursor.style.transform = `translate(${lx}px, ${ly}px)`;
    if(label){ tip.style.display='block'; tip.textContent = label; tip.style.transform = `translate(${lx}px, ${ly+28}px)`; }
    state.last = {x:rx,y:ry};
  }

  // Click dentro del visor
  wrap.querySelector('.agent-stage').addEventListener('click', async (ev)=>{
    if(!agentSessionId) return;
    const r = overlay.getBoundingClientRect();
    const rx = (ev.clientX - r.left)/r.width;
    const ry = (ev.clientY - r.top)/r.height;
    moveCursor(rx, ry, 'Clic');
    await fetch(`${window.AGENT_RUNNER_URL}/api/session/${agentSessionId}/click`, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body:JSON.stringify({ x:rx, y:ry, button:'left' })
    });
  });

  // Acciones rápidas (inyectan texto al input)
  wrap.querySelector('.quick-actions').addEventListener('click', (e)=>{
    const b = e.target.closest('button'); if(!b) return;
    let prefix = '';
    if(b.dataset.q === 'canva') prefix = 'Entrá a Canva y créame un folleto sobre ';
    if(b.dataset.q === 'search') prefix = 'Busca información sobre ';
    if(b.dataset.q === 'open') prefix = 'Abrí la página ';
    inputEl.value = prefix;
    autosize(); setSendEnabled(); inputEl.focus();
  });

  return {
    startStream,
    setStatus:(t)=> status.textContent=t,
    setTip:(t)=>{ tip.style.display = t ? 'block':'none'; if(t) tip.textContent=t; }
  };
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
