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

  // Shell azul + interior con top-tab y statusbar exactos
  wrap.innerHTML = `
    <div class="agent-shell">
      <div class="agent-inner">
        <!-- Top bar con pestaña -->
        <div class="agent-top">
          <div class="agent-tab">Nueva pestaña…</div>
        </div>

        <!-- Stage negro -->
        <div class="agent-stage">
          <img class="frame" alt="pantalla del agente"/>
          <canvas class="agent-overlay"></canvas>
          <img class="agent-cursor" src="static/images/cursor.png" style="display:none"/>
          <div class="agent-tip" style="display:none"></div>
        </div>

        <!-- Statusbar inferior: barra blanca + punto azul + EN DIRECTO -->
        <div class="agent-statusbar">
          <div class="agent-progress"><span class="agent-progress-fill"></span></div>
          <div class="agent-live"><span class="dot"></span> EN DIRECTO</div>
        </div>
      </div>
    </div>
  `;
  messagesEl.appendChild(wrap);
  messagesEl.scrollTop = messagesEl.scrollHeight;

  const frame   = wrap.querySelector('.frame');
  const overlay = wrap.querySelector('.agent-overlay');
  const tip     = wrap.querySelector('.agent-tip');
  const liveEl  = wrap.querySelector('.agent-live');

  // Ajuste de canvas
  function fit(){
    overlay.width  = overlay.clientWidth;
    overlay.height = overlay.clientHeight;
  }
  new ResizeObserver(fit).observe(overlay); fit();

  const state = { timer:null };

  // refresco cada 300 ms
  async function startStream(){
    if(state.timer) clearInterval(state.timer);
    state.timer = setInterval(async ()=>{
      if(!agentSessionId) return;
      frame.src = `${window.AGENT_RUNNER_URL}/api/session/${agentSessionId}/frame?ts=${Date.now()}`;
    }, 300);
  }

  // Click dentro del visor
  wrap.querySelector('.agent-stage').addEventListener('click', async (ev)=>{
    if(!agentSessionId) return;
    const r = overlay.getBoundingClientRect();
    const rx = (ev.clientX - r.left)/r.width;
    const ry = (ev.clientY - r.top)/r.height;
    await fetch(`${window.AGENT_RUNNER_URL}/api/session/${agentSessionId}/click`, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body:JSON.stringify({ x:rx, y:ry, button:'left' })
    });
  });

  return {
    startStream,
    setStatus:(t)=>{ liveEl.dataset.state = t; },
    setTip:(t)=>{ tip.style.display = t ? 'block' : 'none'; if(t) tip.textContent=t; }
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

