// Convierte Markdown básico a HTML
function markdownToHTML(md) {
  if (!md) return "";

  return md
    // Títulos
    .replace(/^### (.*$)/gim, "<h3>$1</h3>")
    .replace(/^## (.*$)/gim, "<h2>$1</h2>")
    .replace(/^# (.*$)/gim, "<h1>$1</h1>")

    // Negritas
    .replace(/\*\*(.*?)\*\*/gim, "<strong>$1</strong>")

    // Separadores ---
    .replace(/^---$/gim, "<hr>")

    // Listas con viñetas
    .replace(/^\- (.*$)/gim, "<li>$1</li>")
    .replace(/^• (.*$)/gim, "<li>$1</li>")

    // Listas numeradas
    .replace(/^\d+\. (.*$)/gim, "<li>$1</li>")

    // Encapsular <li> en <ul> o <ol> automáticamente
    .replace(/(<li>[\s\S]*?<\/li>)/gim, "<ul>$1</ul>")

    // Saltos de línea → párrafos
    .replace(/\n$/gim, "<br>");
}
