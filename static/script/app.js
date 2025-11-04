const modeEl = document.getElementById('mode');
const messagesEl = document.getElementById('messages');
const inputEl = document.getElementById('input');
const sendBtn = document.getElementById('sendBtn');
const agentPanel = document.getElementById('agentPanel');
const agentFrame = document.getElementById('agentFrame');
const agentOverlay = document.getElementById('agentOverlay');
const agentStatus = document.getElementById('agentStatus');
const agentTabs = document.getElementById('agentTabs');
const agentConnectBtn = document.getElementById('agentConnectBtn');
const openCanvaBtn = document.getElementById('openCanva');
const pauseBtn = document.getElementById('pauseAgent');
const resumeBtn = document.getElementById('resumeAgent');

let agentSessionId = null;
let streamTimer = null;
let lastFrameTs = 0;

function addMsg(role, text){
  const div = document.createElement('div');
  div.className = `msg ${role}`;
  div.textContent = text;
  messagesEl.appendChild(div);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

async function askGeneric(text){
  addMsg('user', text);
  const res = await fetch('/ask', {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({message:text, personality: 'generic'})
  });
  const data = await res.json();
  addMsg('assistant', data.reply || '(sin respuesta)');
}

async function askAgent(text){
  addMsg('user', text);
  // envía la “tarea” al runner
  const res = await fetch(`${window.AGENT_RUNNER_URL}/api/agent/task`, {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({ sessionId: agentSessionId, instruction: text })
  });
  const data = await res.json();
  addMsg('assistant', data.ok ? 'Agente: tarea recibida. Mirá el visor a la derecha.' : `Error: ${data.error}`);
}

function toggleAgentUI(){
  const isAgent = modeEl.value === 'agent';
  agentPanel.style.display = isAgent ? '' : 'none';
  agentConnectBtn.style.display = isAgent ? '' : 'none';
}

modeEl.addEventListener('change', toggleAgentUI);
toggleAgentUI();

sendBtn.addEventListener('click', () => {
  const text = inputEl.value.trim();
  if(!text) return;
  inputEl.value = '';
  if(modeEl.value === 'generic') askGeneric(text);
  else askAgent(text);
});

inputEl.addEventListener('keydown', (e)=>{
  if(e.key === 'Enter' && !e.shiftKey){
    e.preventDefault();
    sendBtn.click();
  }
});

// === Agente: conectar visor, recibir capturas, mandar eventos ===
agentConnectBtn.addEventListener('click', async ()=>{
  // Iniciar/obtener sesión de navegador
  const r = await fetch(`${window.AGENT_RUNNER_URL}/api/session/new`, {method:'POST'});
  const d = await r.json();
  if(!d.ok){ agentStatus.textContent = 'No se pudo iniciar sesión del agente.'; return; }
  agentSessionId = d.sessionId;
  agentStatus.textContent = `Sesión: ${agentSessionId}`;
  startStream();
});

function startStream(){
  if(streamTimer) clearInterval(streamTimer);
  streamTimer = setInterval(async ()=>{
    if(!agentSessionId) return;
    // Pull frame
    const imgUrl = `${window.AGENT_RUNNER_URL}/api/session/${agentSessionId}/frame?ts=${Date.now()}`;
    agentFrame.src = imgUrl;
    // Estado + pestañas
    try{
      const s = await fetch(`${window.AGENT_RUNNER_URL}/api/session/${agentSessionId}/status`);
      const sd = await s.json();
      agentStatus.textContent = JSON.stringify(sd.status, null, 2);
      agentTabs.innerHTML = '';
      (sd.tabs||[]).forEach(t=>{
        const li = document.createElement('li');
        li.textContent = t.active ? `• ${t.title}` : t.title;
        agentTabs.appendChild(li);
      });
    }catch{}
  }, 250);
}

// Interacción mouse básica (clic relativo)
agentFrame.addEventListener('click', async (ev)=>{
  if(!agentSessionId) return;
  const rect = agentFrame.getBoundingClientRect();
  const rx = (ev.clientX - rect.left) / rect.width;
  const ry = (ev.clientY - rect.top) / rect.height;
  await fetch(`${window.AGENT_RUNNER_URL}/api/session/${agentSessionId}/click`, {
    method:'POST', headers:{'Content-Type':'application/json'},
    body:JSON.stringify({ x:rx, y:ry, button:'left' })
  });
});

// Teclado al agente
document.addEventListener('keydown', async (ev)=>{
  if(agentPanel.style.display === 'none' || !agentSessionId) return;
  if(ev.metaKey || ev.ctrlKey) return; // simple demo: evita atajos del browser local
  await fetch(`${window.AGENT_RUNNER_URL}/api/session/${agentSessionId}/type`, {
    method:'POST', headers:{'Content-Type':'application/json'},
    body:JSON.stringify({ text: ev.key.length===1 ? ev.key : '' })
  });
});

openCanvaBtn.addEventListener('click', async ()=>{
  if(!agentSessionId) return;
  await fetch(`${window.AGENT_RUNNER_URL}/api/session/${agentSessionId}/goto`, {
    method:'POST', headers:{'Content-Type':'application/json'},
    body:JSON.stringify({ url: "https://www.canva.com/" })
  });
});

pauseBtn.addEventListener('click', async ()=>{
  if(!agentSessionId) return;
  await fetch(`${window.AGENT_RUNNER_URL}/api/session/${agentSessionId}/pause`, {method:'POST'});
});
resumeBtn.addEventListener('click', async ()=>{
  if(!agentSessionId) return;
  await fetch(`${window.AGENT_RUNNER_URL}/api/session/${agentSessionId}/resume`, {method:'POST'});
});
