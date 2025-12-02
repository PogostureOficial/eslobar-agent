function markdownToHTML(md) {
  if (!md) return "";

  // ============================================
// 0) Detectar bloques ```conceptmap ... ```
//    y renderizarlos como un cuadro vistoso
// ============================================

  md = md.replace(/```conceptmap\s*([\s\S]*?)```/gim, (match, content) => {
    // Escapar HTML dentro del mapa
    const safe = content
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .trim();

    return `
      <div class="conceptmap-box">
        <div class="conceptmap-content">
          ${safe.replace(/\n/g, "<br>")}
        </div>
      </div>
    `;
  });


  // Normalizar saltos múltiples (3+ → 2)
  md = md.replace(/\n{3,}/g, "\n\n");

  // ============================
  // 1) Proteger bloques de código ``` ```
  // ============================
  const codeBlocks = [];
  md = md.replace(/```(\w+)?\n([\s\S]*?)```/g, (match, lang, code) => {
    const languageClass = lang ? ` language-${lang}` : "";
    const escaped = code
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    const html = `<pre><code class="code-block${languageClass}">${escaped}</code></pre>`;
    codeBlocks.push(html);
    return `@@CODEBLOCK${codeBlocks.length - 1}@@`;
  });

  // ============================
  // 2) Encabezados (ahora H1–H6)
  // ============================
  md = md.replace(/^###### (.*)$/gim, "<h6>$1</h6>");
  md = md.replace(/^##### (.*)$/gim, "<h5>$1</h5>");
  md = md.replace(/^#### (.*)$/gim, "<h4>$1</h4>");

  // (Tus reglas originales)
  md = md.replace(/^### (.*)$/gim, "<h3>$1</h3>");
  md = md.replace(/^## (.*)$/gim, "<h2>$1</h2>");
  md = md.replace(/^# (.*)$/gim, "<h1>$1</h1>");

  // ============================
  // 3) Líneas separadoras (---, ***, ___)
  // ============================
  // (Tu regla original)
  md = md.replace(/^\s*---\s*$/gim, "<hr>");
  // Nuevas variantes
  md = md.replace(/^\s*(\*\*\*|___)\s*$/gim, "<hr>");

  // ============================
  // 4) Blockquotes (cuadros) con ">"
  // ============================
  md = md.replace(/(^> .*(\n> .*)*)/gim, (match) => {
    const inner = match
      .replace(/^> ?/gim, "")
      .replace(/\n/g, "<br>");
    return `<blockquote>${inner}</blockquote>`;
  });

  // ============================
  // 5) Listas con viñeta (tu código)
  // ============================
  md = md.replace(/^\s*[-•] (.*)$/gim, "<ul><li>$1</li></ul>");

  // ============================
  // 6) Listas numeradas (tu código)
  // ============================
  md = md.replace(/^\s*\d+\. (.*)$/gim, "<ol><li>$1</li></ol>");

  // Compactar listas múltiples (tu código)
  md = md.replace(/<\/ul>\s*<ul>/gim, "");
  md = md.replace(/<\/ol>\s*<ol>/gim, "");

  // ============================
  // 7) Listas de tareas - [ ] / [x]
  // ============================
  md = md.replace(
    /<li>\s*\[ \]\s*(.*?)<\/li>/gim,
    '<li class="task-item"><input type="checkbox" disabled> $1</li>'
  );
  md = md.replace(
    /<li>\s*\[x\]\s*(.*?)<\/li>/gim,
    '<li class="task-item"><input type="checkbox" disabled checked> $1</li>'
  );
  md = md.replace(
    /<ul>\s*(<li class="task-item">)/gim,
    '<ul class="task-list">$1'
  );

  // ============================
  // 8) Tablas estilo GitHub
  // ============================
  md = md.replace(/((?:\|[^\n]+\|\n)+)/g, (match) => {
    const lines = match.trim().split("\n");
    if (lines.length < 2) return match;

    const header = lines[0].trim();
    const separator = lines[1].trim();

    // Comprobamos que la segunda fila sea de separadores --- :--- etc.
    if (!/^\|[:\- ]+\|/.test(separator)) return match;

    const parseRow = (row) =>
      row
        .trim()
        .replace(/^\||\|$/g, "")
        .split("|")
        .map((cell) => cell.trim());

    const headers = parseRow(header);
    const rows = lines.slice(2).map(parseRow);

    let html = '<table class="md-table"><thead><tr>';
    headers.forEach((h) => {
      html += `<th>${h}</th>`;
    });
    html += "</tr></thead>";

    if (rows.length) {
      html += "<tbody>";
      rows.forEach((cols) => {
        if (cols.length === 1 && cols[0] === "") return;
        html += "<tr>";
        cols.forEach((c) => {
          html += `<td>${c}</td>`;
        });
        html += "</tr>";
      });
      html += "</tbody>";
    }
    html += "</table>";
    return html;
  });

  // ============================
  // 9) Imágenes ![alt](url)
  // ============================
  md = md.replace(
    /!\[([^\]]*)\]\(([^)]+)\)/gim,
    '<img src="$2" alt="$1">'
  );

  // ============================
  // 10) Links [texto](url)
  // ============================
  md = md.replace(
    /\[([^\]]+)\]\(([^)]+)\)/gim,
    '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
  );

  // ============================
  // 11) Código en línea `code`
  // ============================
  md = md.replace(
    /`([^`]+)`/gim,
    '<code class="code-inline">$1</code>'
  );

  // ============================
  // 12) Negrita + cursiva ***texto***
  // ============================
  md = md.replace(
    /\*\*\*(.*?)\*\*\*/gim,
    "<strong><em>$1</em></strong>"
  );

  // ============================
  // 13) Negritas **texto** (tu código)
  // ============================
  md = md.replace(/\*\*(.*?)\*\*/gim, "<strong>$1</strong>");

  // ============================
  // 14) Cursiva *texto*
  // (evitando conflictos con ** **)
  // ============================
  md = md.replace(
    /(^|[^\*])\*(?!\*)([^*\n]+)\*(?!\*)/gim,
    "$1<em>$2</em>"
  );

  // ============================
  // 15) Tachado ~~texto~~
  // ============================
  md = md.replace(/~~(.*?)~~/gim, "<del>$1</del>");

  // ============================
  // 16) Matemáticas: $$block$$ y \(...\)
  // ============================
  md = md.replace(
    /\$\$([\s\S]+?)\$\$/gim,
    '<div class="math-block">$1</div>'
  );
  md = md.replace(
    /\\\((.+?)\\\)/gim,
    '<span class="math-inline">$1</span>'
  );

  // ============================
  // 17) Párrafos (tu lógica, extendida
  //     para no envolver nuevos tags)
  // ============================
  md = md.replace(
    /^(?!\s*<\/?(h1|h2|h3|h4|h5|h6|ul|ol|li|hr|pre|code|blockquote|table|thead|tbody|tr|th|td|img|div|span)\b)(.+)$/gim,
    (match, p1, p2) => {
      const text = p2.trim();
      return text ? `<p>${text}</p>` : "";
    }
  );

  // ============================
  // 18) Restaurar bloques de código
  // ============================
  md = md.replace(/@@CODEBLOCK(\d+)@@/g, (match, index) => {
    return codeBlocks[Number(index)];
  });

  return md.trim();
}


