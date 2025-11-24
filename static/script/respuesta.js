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
 * Typewriter SMART token x token (tipo ChatGPT)
 * - Respeta bloques: <pre>, <ul>/<ol>, <hr>
 * - Texto normal (p, div, h1, h2, h3, etc.) → palabra por palabra
 * - Si el HTML viene envuelto en .markdown-body, se mantiene esa clase
 * - onDone se llama cuando terminó TODO el mensaje
 */
function typeWriterFull(element, html, tokenDelay = 30, onDone) {
  const temp = document.createElement("div");
  temp.innerHTML = html.trim();

  let rootContainer = element;
  let nodes;

  // Si viene envuelto en <div class="markdown-body">, preservamos el wrapper
  const firstElem = temp.firstElementChild;
  if (
    firstElem &&
    firstElem.classList &&
    firstElem.classList.contains("markdown-body") &&
    temp.childElementCount === 1
  ) {
    const wrapper = document.createElement("div");
    wrapper.className = "markdown-body";
    element.appendChild(wrapper);
    rootContainer = wrapper;
    nodes = Array.from(firstElem.childNodes);
  } else {
    nodes = Array.from(temp.childNodes);
  }

  let cursorDot = null; // círculo negro que aparece mientras se genera

  function finishAll() {
    // Highlight final por si quedó algo sin colorear
    applyHighlight(element);

    // Apagar círculo cuando termina todo
    if (cursorDot) {
      cursorDot.classList.add("done");
    }

    if (typeof onDone === "function") onDone();
  }

  function processNode(i = 0) {
    if (i >= nodes.length) {
      return finishAll();
    }

    const node = nodes[i];

    // Saltar textos vacíos
    if (node.nodeType === Node.TEXT_NODE) {
      const text = (node.textContent || "").trim();
      if (!text) {
        return processNode(i + 1);
      }
      return streamBlock("p", text, () => processNode(i + 1));
    }

    if (node.nodeType === Node.ELEMENT_NODE) {
      const tag = node.tagName.toUpperCase();

      // === Bloques de código: se insertan enteros y se colorean ===
      if (tag === "PRE") {
        const clone = node.cloneNode(true);
        rootContainer.appendChild(clone);
        smartScroll();

        clone.querySelectorAll("code").forEach(block => {
          try { hljs.highlightElement(block); } catch (e) {}
        });

        return setTimeout(() => processNode(i + 1), 120);
      }

      // === HR: separador directo ===
      if (tag === "HR") {
        const hr = document.createElement("hr");
        rootContainer.appendChild(hr);
        smartScroll();
        return setTimeout(() => processNode(i + 1), 80);
      }

      // === Listas UL / OL ===
      if (tag === "UL" || tag === "OL") {
        return streamList(node, () => processNode(i + 1));
      }

      // === Cualquier otro elemento textual (p, div, h1, h2, h3, etc.) ===
      const text = (node.textContent || "").trim();
      if (!text) {
        return processNode(i + 1);
      }
      return streamBlock(node.tagName.toLowerCase(), text, () => processNode(i + 1));
    }

    // Si no es texto ni elemento, seguimos
    processNode(i + 1);
  }

   // ---- Stream de un bloque de texto (p, div, h1, h2, h3...) token x token ----
  function streamBlock(tagName, text, done) {
    const blockEl = document.createElement(tagName);
    const textSpan = document.createElement("span");
    textSpan.className = "token-stream";

    // Crear el cursor si no existe
    if (!cursorDot) {
      cursorDot = document.createElement("span");
      cursorDot.className = "token-dot";
    }

    // Siempre re-enganchar el cursor al bloque actual,
    // después del texto → "Hola, ¿en qué●"
    blockEl.appendChild(textSpan);
    blockEl.appendChild(cursorDot);

    rootContainer.appendChild(blockEl);
    smartScroll();

    const tokens = text.split(/(\s+)/); // conserva espacios
    let idx = 0;

    function step() {
      if (idx >= tokens.length) {
        return setTimeout(done, 60);
      }
      textSpan.textContent += tokens[idx++];
      smartScroll();
      setTimeout(step, tokenDelay);
    }

    step();
  }

  // ---- Stream de listas UL/OL, cada <li> token x token ----
  function streamList(listNode, done) {
    const listEl = document.createElement(listNode.tagName.toLowerCase());
    rootContainer.appendChild(listEl);

    const items = Array.from(listNode.children).filter(
      child => child.tagName && child.tagName.toUpperCase() === "LI"
    );

    function processItem(itemIndex) {
      if (itemIndex >= items.length) {
        return setTimeout(done, 60);
      }

      const liEl = document.createElement("li");
      const textSpan = document.createElement("span");
      textSpan.className = "token-stream";

      // Crear cursor si no existe y moverlo a este <li>
      if (!cursorDot) {
        cursorDot = document.createElement("span");
        cursorDot.className = "token-dot";
      }

      liEl.appendChild(textSpan);
      liEl.appendChild(cursorDot); // el punto va al final de la línea
      listEl.appendChild(liEl);
      smartScroll();

      const txt = (items[itemIndex].textContent || "").trim();
      const tokens = txt.split(/(\s+)/);
      let tIndex = 0;

      function stepToken() {
        if (tIndex >= tokens.length) {
          return setTimeout(() => processItem(itemIndex + 1), 40);
        }
        textSpan.textContent += tokens[tIndex++];
        smartScroll();
        setTimeout(stepToken, tokenDelay);
      }

      stepToken();
    }

    processItem(0);
  }

  // Empezar
  processNode();
}

// Highlight automático (como ya lo tenías)
function applyHighlight(el) {
  el.querySelectorAll("pre code").forEach(block => {
    try {
      hljs.highlightElement(block);
    } catch (err) {
      console.warn("Highlight error:", err);
    }
  });
}


// Typewriter simple para una sola línea / párrafo de texto
function typeWriterText(element, text, speed = 3) {
  let i = 0;

  function step() {
    if (!element.isConnected) return; // si se borró el loader, frenamos
    element.textContent = text.slice(0, i++);
    smartScroll();

    if (i <= text.length) {
      setTimeout(step, speed);
    }
  }

  step();
}


/**
 * Muestra burbuja de carga de la IA
 */
function showLoadingBubble(userMsg) {
  const div = document.createElement("div");
  div.className = "msg assistant";

  // Puntito inicial
  const bubble = document.createElement("div");
  bubble.className = "ai-loading";
  div.appendChild(bubble);

  messagesEl.appendChild(div);
  smartScroll();

  let thinkingEl = null;
  let detailEl = null;

  // === 1) A los 4 segundos → mostrar ("Pensando...")
  setTimeout(() => {
    if (!div.isConnected) return;

    bubble.remove();

    thinkingEl = document.createElement("span");
    thinkingEl.className = "thinking-text";
    thinkingEl.textContent = "Pensando";
    div.appendChild(thinkingEl);
    smartScroll();

    // === 2) Pedir al servidor la frase inteligente + descripción
    fetch("/action", {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({ message: userMsg })
    })
      .then(res => res.json())
      .then(data => {
        if (!div.isConnected) return;

        const shortText = data.action || "Procesando";
        const descText  = data.description || "";

        // Frase corta (arriba)
        thinkingEl.textContent = shortText;

        // Descripción (abajo) con typewriter
        if (descText) {
          detailEl = document.createElement("div");
          detailEl.className = "thinking-detail";
          div.appendChild(detailEl);

          // animación tipo ChatGPT
          typeWriterText(detailEl, descText, 3);
        }
      })
      .catch(() => {
        if (!div.isConnected) return;
        thinkingEl.textContent = "Procesando…";
      });

  }, 4000);

  return div;
}




// ============= PATCH a askGeneric para integrar la UI =============

// ============= PATCH a askGeneric para integrar la UI =============

// Guardamos la función original (por si la querés usar en otro lado)
const originalAskGeneric = askGeneric;

// Sobrescribimos askGeneric con UI mejorada
askGeneric = async function (text) {
  addTextMsg("user", text);

  const loadingEl = showLoadingBubble(text);

  try {
    const res = await fetch("/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: text, model: currentModel }),
    });

    const data = await res.json();

    // Sacar la burbuja de "Pensando..."
    loadingEl.remove();

    // Crear el contenedor vacío de la IA
    const aiDiv = addTextMsg("assistant", "");
    const html = markdownToHTML(data.reply || "(sin respuesta)");

    // Typewriter token x token
    typeWriterFull(aiDiv, html, 30, () => {
      // Cuando termina TODO el mensaje:
      const actions = aiDiv.parentElement.querySelector(".msg-actions");
      if (actions) {
        actions.style.display = "flex";
        requestAnimationFrame(() => actions.classList.add("show"));
      }
    });
  } catch (err) {
    loadingEl.remove();
    console.error("ERROR EN RESPUESTA.JS:", err);
    const aiDiv = addTextMsg("assistant", "");
    aiDiv.innerText = "⚠️ Error en cliente: " + err;

    // Si querés, también mostrar botones en caso de error
    const actions = aiDiv.parentElement.querySelector(".msg-actions");
    if (actions) {
      actions.style.display = "flex";
      requestAnimationFrame(() => actions.classList.add("show"));
    }
  }
};






















