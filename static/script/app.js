// ========= DOM refs =========
const modeEl = document.getElementById('mode');
const messagesEl = document.getElementById('messages');
const inputEl = document.getElementById('input');
const sendBtn = document.getElementById('sendBtn');
const agentConnectBtn = document.getElementById('agentConnectBtn'); // seguimos por si lo querés usar manual

// ========= Config =========
window.AGENT_RUNNER_URL = localStorage.getItem("AGENT_RUNNER_URL") || "https://agent-runner-tpcc.onrender.com";

// ========= State =========
let agentSessionId = null;

// ========= Chat helpers =========
function addTextMsg(role, text){
  const div = document.createElement('div');
  div.className = `msg ${role}`;
  div.textContent = text;
  messagesEl.appendChild(div);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  return div;
}

async function askGeneric(text){
  addTextMsg('user', text);
  const res = await fetch('/ask', {
    method:'POST', headers:{'Content-Type':'application/json'},
    body:JSON.stringify({message:text, personality: 'generic'})
  });
  const data = await res.json();
  addTextMsg('assistant', data.reply || '(sin respuesta)');
}

// ========= Agent Live Card (ChatGPT-like) =========
function makeLiveAgentCard(titleText = 'Agente en vivo'){
  const wrapMsg = document.createElement('div');
  wrapMsg.className = 'msg assistant agent-live';

  wrapMsg.innerHTML = `
    <div class="live-wrap">
      <div class="live-header">
        <div><strong>${titleText}</strong> <span class="status">Conectando…</span></div>
        <div class="actions">
          <button data-act="open-canva">Abrir Canva</button>
          <button data-act="pause">Pausar</button>
          <button data-act="resume">Reanudar</button>
        </div>
      </div>
      <div class="live-stage">
        <img class="frame" alt="pantalla del agente"/>
        <canvas class="overlay"></canvas>
        <img class="live-cursor" src="static/images/cursor.png" style="display:none"/>
        <div class="live-tooltip" style="display:none"></div>
      </div>
      <div class="live-footer">
        EN DIRECTO — podés hacer clic/tipear dentro de este bloque para controlar al agente.
        <span class="url"></span>
      </div>
    </div>
  `;

  messagesEl.appendChild(wrapMsg);
  messagesEl.scrollTop = messagesEl.scrollHeight;

  // refs locales
  const frame = wrapMsg.querySelector('.frame');
  const overlay = wrapMsg.querySelector('.overlay');
  const statusEl = wrapMsg.querySelector('.status');
  const urlEl = wrapMsg.querySelector('.live-footer .url');
  const cursorEl = wrapMsg.querySelector('.live-cursor');
  const tipEl = wrapMsg.querySelector('.live-tooltip');

  // canvas sizing
  function fitCanvas(){
    overlay.width = overlay.clientWidth;
    overlay.height = overlay.clientHeight;
  }
  new ResizeObserver(fitCanvas).observe(overlay);
  fitCanvas();

  // simple state por card
  const state = {
    timer: null,
    lastCursor: { x: 0.5, y: 0.5 },
    anim: null
  };

  // stream pull
  async function startStream(){
    if(state.timer) clearInterval(state.timer);
    state.timer = setInterval(async ()=>{
      if(!agentSessionId) return;
      frame.src = `${window.AGENT_RUNNER_URL}/api/session/${agentSessionId}/frame?ts=${Date.now()}`;
      try{
        const s = await fetch(`${window.AGENT_RUNNER_URL}/api/session/${agentSessionId}/status`);
        const sd = await s.json();
        if(sd.ok){
          statusEl.textContent = sd.status.paused ? 'Pausado' : 'En vivo';
          urlEl.textContent = sd.status.url || '';
        }
      }catch{}
    }, 250);
  }

  // util: mover cursor con animación
  function moveCursorTo(rx, ry, label){
    const rect = overlay.getBoundingClientRect();
    const x = rect.left + rx * rect.width;
    const y = rect.top + ry * rect.height;

    cursorEl.style.display = 'block';
    tipEl.style.display = label ? 'block' : 'none';
    if(label) tipEl.textContent = label;

    // animación suave
    const start = state.lastCursor;
    const steps = 12; let i = 0;
    if(state.anim) cancelAnimationFrame(state.anim);
    function step(){
      i++;
      const t = i/steps;
      const cx = start.x + (rx - start.x) * t;
      const cy = start.y + (ry - start.y) * t;

      const lx = cx * overlay.clientWidth;
      const ly = cy * overlay.clientHeight;

      cursorEl.style.transform = `translate(${lx}px, ${ly}px)`;
      tipEl.style.transform = `translate(${lx}px, ${ly+32}px)`;

      if(i < steps) state.anim = requestAnimationFrame(step);
      else state.lastCursor = { x: rx, y: ry };
    }
    state.anim = requestAnimationFrame(step);
  }

  // click del usuario dentro del frame
  wrapMsg.querySelector('.live-stage').addEventListener('click', async (ev)=>{
    if(!agentSessionId) return;
    const r = overlay.getBoundingClientRect();
    const rx = (ev.clientX - r.left) / r.width;
    const ry = (ev.clientY - r.top) / r.height;

    moveCursorTo(rx, ry, 'Clic');
    await fetch(`${window.AGENT_RUNNER_URL}/api/session/${agentSessionId}/click`, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body:JSON.stringify({ x:rx, y:ry, button:'left' })
    });
  });

  // teclado cuando el bloque tiene foco
  wrapMsg.addEventListener('keydown', async (ev)=>{
    if(!agentSessionId) return;
    // evitamos atajos del browser local
    if(ev.metaKey || ev.ctrlKey) return;
    const text = ev.key.length === 1 ? ev.key : (ev.key === 'Enter' ? '\n' : '');
    if(!text) return;
    tipEl.style.display='block'; tipEl.textContent = `Escribiendo…`;
    await fetch(`${window.AGENT_RUNNER_URL}/api/session/${agentSessionId}/type`, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body:JSON.stringify({ text })
    });
  });
  // permitir foco con Tab y click
  wrapMsg.tabIndex = 0;

  // acciones header
  wrapMsg.querySelector('.actions').addEventListener('click', async (e)=>{
    const a = e.target.closest('button'); if(!a) return;
    const act = a.getAttribute('data-act');
    if(act === 'open-canva'){
      tipEl.style.display='block'; tipEl.textContent = 'Abriendo canva.com…';
      await fetch(`${window.AGENT_RUNNER_URL}/api/session/${agentSessionId}/goto`, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body:JSON.stringify({ url: "https://www.canva.com/" })
      });
      moveCursorTo(.14, .11, 'Navegando…');
    }else if(act==='pause'){
      await fetch(`${window.AGENT_RUNNER_URL}/api/session/${agentSessionId}/pause`, {method:'POST'});
      statusEl.textContent = 'Pausado';
    }else if(act==='resume'){
      await fetch(`${window.AGENT_RUNNER_URL}/api/session/${agentSessionId}/resume`, {method:'POST'});
      statusEl.textContent = 'En vivo';
    }
  });

  // API pública de la card
  return {
    el: wrapMsg,
    startStream, moveCursorTo,
    setStatus: (t)=> statusEl.textContent = t,
    setTip: (t)=> { tipEl.style.display = t ? 'block':'none'; if(t) tipEl.textContent = t; }
  };
}

// ========= Agent session =========
async function ensureAgentSession(){
  if(agentSessionId) return agentSessionId;
  const r = await fetch(`${window.AGENT_RUNNER_URL}/api/session/new`, {method:'POST'});
  const d = await r.json();
  if(!d.ok) throw new Error(d.error || 'No se pudo crear sesión');
  agentSessionId = d.sessionId;
  return agentSessionId;
}

// ========= Send flow =========
sendBtn.addEventListener('click', async ()=>{
  const text = inputEl.value.trim();
  if(!text) return;
  inputEl.value = '';

  if(modeEl.value === 'generic'){
    return askGeneric(text);
  }

  // Agente
  addTextMsg('user', text);

  // 1) crear card live en el chat
  const live = makeLiveAgentCard('Agente (en vivo)');
  live.setStatus('Conectando…');

  try{
    // 2) asegurar sesión + arrancar stream
    await ensureAgentSession();
    live.setStatus('En vivo');
    live.startStream();

    // 3) enviar tarea al runner (esto puede abrir canva, etc.)
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

  }catch(err){
    live.setStatus('Error');
    live.setTip('No se pudo iniciar el agente.');
    addTextMsg('assistant', `No se pudo iniciar el agente: ${String(err)}`);
  }
});

// Enter en textarea
inputEl.addEventListener('keydown', (e)=>{
  if(e.key === 'Enter' && !e.shiftKey){
    e.preventDefault();
    sendBtn.click();
  }
});

// Modo: mostrar/ocultar botón conectar manual (opcional)
function syncUI(){
  const isAgent = modeEl.value === 'agent';
  agentConnectBtn.style.display = isAgent ? '' : 'none';
}
modeEl.addEventListener('change', syncUI);
syncUI();

// Botón conectar visor manual (opcional)
agentConnectBtn.addEventListener('click', async ()=>{
  try{
    await ensureAgentSession();
    addTextMsg('assistant','Sesión del agente creada. Podés enviar una instrucción.');
  }catch(err){
    addTextMsg('assistant','No se pudo crear la sesión del agente.');
  }
});
