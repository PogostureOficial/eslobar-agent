// ==================
// RESPUESTA CON LOADING + TYPEWRITER (SMART)
// ==================

function smartScroll() {
  messagesEl.scrollTo({
    top: messagesEl.scrollHeight,
    behavior: "smooth"
  });
}

/**
 * Typewriter SMART: respeta HTML
 * - Títulos, listas, hr → aparecen instantáneo
 * - Párrafos → animados
 */
function typeWriterSmart(element, html, speed = 18) {
  const container = document.createElement("div");
  container.innerHTML = html;
  const nodes = Array.from(container.childNodes);

  function processNode(index = 0) {
    if (index >= nodes.length) return;

    const node = nodes[index];

    // Elementos que deben aparecer instantáneos
    if (["H1", "H2", "H3", "UL", "OL", "HR"].includes(node.tagName)) {
      element.appendChild(node);
      messagesEl.scrollTop = messagesEl.scrollHeight;
      setTimeout(() => processNode(index + 1), 80);
      return;
    }

    // Párrafos animados (por palabra)
    if (node.nodeType === Node.ELEMENT_NODE) {
      const text = (node.innerHTML || "").trim();
      const words = text.split(" ");
      const newEl = document.createElement(node.tagName || "p");
      element.appendChild(newEl);

      let i = 0;
      function type() {
        newEl.innerHTML = words.slice(0, i).join(" ");
        messagesEl.scrollTop = messagesEl.scrollHeight;

        if (i < words.length) {
          i++;
          setTimeout(type, speed);
        } else {
          setTimeout(() => processNode(index + 1), 120);
        }
      }
      type();
    }
  }

  processNode();
}


/**
 * Muestra burbuja de carga de la IA
 */
function showLoadingBubble() {
  const div = document.createElement('div');
  div.className = "msg assistant";

  const bubble = document.createElement('div');
  bubble.className = "ai-loading";

  div.appendChild(bubble);
  messagesEl.appendChild(div);
  smartScroll();
  return div;
}

// ============= PATCH a askGeneric para integrar la UI =============

// Guardamos la función original
const originalAskGeneric = askGeneric;

// Sobrescribimos askGeneric con UI mejorada
askGeneric = async function(text) {
  addTextMsg('user', text);

  const loadingEl = showLoadingBubble();

  try {
    const res = await fetch('/ask', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({ message:text, model: currentModel })
    });

    const data = await res.json();

    loadingEl.remove();

    const aiDiv = addTextMsg('assistant', "");
    const html = markdownToHTML(data.reply || "(sin respuesta)");
    typeWriterSmart(aiDiv, html);

  } catch (err) {
    loadingEl.remove();
    console.error("ERROR EN RESPUESTA.JS:", err);
    const aiDiv = addTextMsg('assistant', "");
    aiDiv.innerText = "⚠️ Error en cliente: " + err;
  }

};


