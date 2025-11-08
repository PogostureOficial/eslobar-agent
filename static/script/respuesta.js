// ==================
// RESPUESTA CON LOADING + TYPEWRITER
// ==================

/**
 * Efecto máquina de escribir
 * element: nodo donde escribir
 * text: texto completo
 * speed: velocidad (ms por letra)
 */
function typeWriterEffect(element, html, speed = 8) {
  const container = document.createElement("div");
  container.innerHTML = html;

  const nodes = Array.from(container.childNodes);

  function processNode(index = 0) {
    if (index >= nodes.length) return;

    const node = nodes[index];

    // Caso 1: Si es un título, lista, HR o elemento estructural → mostrar instantáneo
    if (
      node.tagName === "H1" ||
      node.tagName === "H2" ||
      node.tagName === "H3" ||
      node.tagName === "UL" ||
      node.tagName === "OL" ||
      node.tagName === "HR"
    ) {
      element.appendChild(node);
      element.scrollTop = element.scrollHeight;
      setTimeout(() => processNode(index + 1), 80);
      return;
    }

    // Caso 2: Si es texto o un párrafo → animarlo
    if (node.nodeType === Node.ELEMENT_NODE || node.nodeType === Node.TEXT_NODE) {
      const text = node.innerHTML || node.textContent;
      const newEl = document.createElement(node.tagName || "p");
      element.appendChild(newEl);

      let i = 0;
      function type() {
        newEl.innerHTML = text.slice(0, i++);
        element.scrollTop = element.scrollHeight;

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
 * Devuelve el elemento creado para luego eliminarlo
 */
function showLoadingBubble() {
  const div = document.createElement('div');
  div.className = "msg assistant";
  
  const bubble = document.createElement('div');
  bubble.className = "ai-loading";

  div.appendChild(bubble);
  messagesEl.appendChild(div);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  return div; // para poder borrarlo después
}


// ============= PATCH a askGeneric para integrar la UI =============

// Guardamos la función original
const originalAskGeneric = askGeneric;

// Sobrescribimos askGeneric con UI mejorada
askGeneric = async function(text) {
  addTextMsg('user', text);

  // Mostrar burbuja de carga
  const loadingEl = showLoadingBubble();

  try {
    const res = await fetch('/ask', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({ message:text, model: currentModel })
    });

    const data = await res.json();

    // Quitar loading
    loadingEl.remove();

    // Crear burbuja vacía para escribir ahí
    const aiDiv = addTextMsg('assistant', "");
    const html = markdownToHTML(data.reply || "(sin respuesta)");
    typeWriterEffect(aiDiv, html);

    
  } catch (err) {
    loadingEl.remove();
    const aiDiv = addTextMsg('assistant', "");
    typeWriterEffect(aiDiv, "Error al consultar el modelo.");
  }
};




