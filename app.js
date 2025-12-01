import { ChatKit } from "";

// Inicialización del UI
const chat = new ChatKit({
  element: document.getElementById("chatkit-root"),

  // Configuración visual y funcional
  options: {
    api: {
      baseUrl: "https://eslobar-agent.vercel.app/ask", // o tu endpoint Flask
      // Sin headers. Eliminar Authorization.
    },

    theme: {
      colorScheme: "dark",
      radius: "pill",
      density: "compact",
      color: {
        accent: { primary: "#8ab4ff" }
      },
      typography: {
        baseSize: 16,
        fontFamily: "OpenAI, system-ui",
        fontSources: [
          {
            family: "OpenAI Sans",
            src: "https://cdn.openai.com/common/fonts/openai-sans/v2/OpenAISans-Regular.woff2",
            weight: 400,
            display: "swap"
          }
        ]
      }
    },

    composer: {
      attachments: { enabled: true },
      models: [
        { id: "gpt-5", label: "GPT-5", default: true },
        { id: "gpt-4.1-mini", label: "GPT-4.1 Mini" }
      ]
    },

    startScreen: {
      greeting: "Bienvenido a Eslobar",
      prompts: [
        { icon: "bolt", label: "¿Qué puedes hacer?", prompt: "¿Qué puede hacer Eslobar?" }
      ]
    }
  }
});



