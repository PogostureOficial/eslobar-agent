function markdownToHTML(md) {
  if (!md) return "";

  // Normalizar saltos múltiples (3+ → 2)
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

  // Compactar listas múltiples
  md = md.replace(/<\/ul>\s*<ul>/gim, "");
  md = md.replace(/<\/ol>\s*<ol>/gim, "");

  // ✨ Párrafos: envolver SOLO bloques de texto que no son listas, títulos ni hr
  md = md.replace(
    /^(?!\s*<\/?(h1|h2|h3|ul|ol|li|hr)\b)(.+)$/gim,
    (match, p1, p2) => {
      const text = p2.trim();
      return text ? `<p>${text}</p>` : "";
    }
  );

  return md.trim();
}
