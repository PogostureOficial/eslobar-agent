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
function typeWriterSmart(element, html, speed = 8) {
  const container = document.createElement("div");
  container.innerHTML = html;
  const nodes = Array.from(container.childNodes);

  function processNode(index = 0) {
    if (index >= nodes.length) return;

    const node = nodes[index];

    // Caso 1: Elementos instantáneos (no tipeados)
    if (
      node.tagName === "H1" ||
      node.tagName === "H2" ||
      node.tagName === "H3" ||
      node.tagName === "UL" ||
      node.tagName === "OL" ||
      node.tagName === "HR"
    ) {
      element.appendChild(node);
      smartScroll();
      setTimeout(() => processNode(index + 1), 100);
      return;
    }

    // Caso 2: Texto / párrafos → animados
    if (node.nodeType === Node.ELEMENT_NODE || node.nodeType === Node.TEXT_NODE) {
      const text = node.innerHTML || node.textContent || "";
      const newEl = document.createElement(node.tagName || "p");
      element.appendChild(newEl);

      let i = 0;
      function type() {
        newEl.innerHTML = text.slice(0, i++);
        smartScroll();

        if (i <= text.length) {
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

