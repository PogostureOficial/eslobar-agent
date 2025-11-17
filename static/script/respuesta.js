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
function typeWriterFull(element, html, speed = 9) {
  const temp = document.createElement("div");
  temp.innerHTML = html.trim();

  const nodes = Array.from(temp.childNodes);

  function processNode(i = 0) {
    if (i >= nodes.length) return;

    const node = nodes[i];

    // ------------------------------
    // HR → aparece instantáneo
    // ------------------------------
    if (node.tagName === "HR") {
      element.appendChild(node);
      smartScroll();
      return setTimeout(() => processNode(i + 1), 120);
    }

    // -----------------------------------------
    // LISTAS → UL/OL aparecen instantáneas
    //   pero CADA <li> se escribe letra por letra
    // -----------------------------------------
    if (node.tagName === "UL" || node.tagName === "OL") {
      const listClone = node.cloneNode(false);
      element.appendChild(listClone);

      const items = Array.from(node.childNodes);

      function processItem(j = 0) {
        if (j >= items.length) return setTimeout(() => processNode(i + 1), 80);

        const li = document.createElement("li");
        listClone.appendChild(li);

        const text = items[j].textContent || "";
        let k = 0;

        function typeItem() {
          li.textContent = text.slice(0, k++);
          smartScroll();

          if (k <= text.length) {
            setTimeout(typeItem, speed);
          } else {
            setTimeout(() => processItem(j + 1), 60);
          }
        }

        typeItem();
      }

      return processItem();
    }

    // -----------------------------------------
    // TITULOS (H1 / H2 / H3) → letra por letra
    // -----------------------------------------
    if (node.tagName === "H1" || node.tagName === "H2" || node.tagName === "H3") {
      const newEl = document.createElement(node.tagName.toLowerCase());
      element.appendChild(newEl);

      const text = node.textContent;
      let k = 0;

      function typeTitle() {
        newEl.textContent = text.slice(0, k++);
        smartScroll();

        if (k <= text.length) {
          setTimeout(typeTitle, speed);
        } else {
          setTimeout(() => processNode(i + 1), 120);
        }
      }

      return typeTitle();
    }

    // -----------------------------------------
    // TEXTO / PÁRRAFOS / SPAN / DIV → letra x letra
    // -----------------------------------------
    if (node.nodeType === Node.TEXT_NODE || node.nodeType === Node.ELEMENT_NODE) {
      const text = node.textContent || "";
      const tag = node.tagName ? node.tagName.toLowerCase() : "p";

      const newEl = document.createElement(tag);
      element.appendChild(newEl);

      let j = 0;

      function type() {
        newEl.textContent = text.slice(0, j++);
        smartScroll();

        if (j <= text.length) {
          setTimeout(type, speed);
        } else {
          setTimeout(() => processNode(i + 1), 80);
        }
      }

      return type();
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
    typeWriterFull(aiDiv, html);


  } catch (err) {
    loadingEl.remove();
    console.error("ERROR EN RESPUESTA.JS:", err);
    const aiDiv = addTextMsg('assistant', "");
    aiDiv.innerText = "⚠️ Error en cliente: " + err;
  }

};




