function markdownToHTML(md) {
  if (!md) return "";

  // Normalizar saltos múltiples: convertir 3+ saltos en 2
  md = md.replace(/\n{3,}/g, "\n\n");

  // Encabezados
  md = md.replace(/^### (.*)$/gim, "<h3>$1</h3>");
  md = md.replace(/^## (.*)$/gim, "<h2>$1</h2>");
  md = md.replace(/^# (.*)$/gim, "<h1>$1</h1>");

  // Negritas
  md = md.replace(/\*\*(.*?)\*\*/gim, "<strong>$1</strong>");

  // Línea separadora
  md = md.replace(/^\s*---\s*$/gim, "<hr>");

  // Listas con viñeta
  md = md.replace(/^\s*[-•] (.*)$/gim, "<ul><li>$1</li></ul>");

  // Listas numeradas
  md = md.replace(/^\s*\d+\. (.*)$/gim, "<ol><li>$1</li></ol>");

  // Compactar listas: juntar <ul>…</ul> repetidos
  md = md.replace(/<\/ul>\s*<ul>/gim, "");
  md = md.replace(/<\/ol>\s*<ol>/gim, "");

  // Párrafos: envolver solo bloques que no son parte de listas ni títulos
  md = md.replace(/^(?!<h\d|<ul>|<ol>|<hr|<\/ul>|<\/ol|<li)(.+)$/gim, "<p>$1</p>");

  return md.trim();
}
