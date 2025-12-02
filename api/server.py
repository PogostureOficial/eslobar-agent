from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from openai import OpenAI
import os

# ===========================
# MEMORIA DE CONVERSACIÓN (últimos 10 mensajes)
# ===========================
conversation_history = []  # lista de dicts: {"role": "user"/"assistant", "content": "..."}
MAX_HISTORY = 10


app = Flask(__name__, static_folder='static')
CORS(app)

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))


@app.route('/')
def root():
    return send_from_directory('.', 'index.html')

concept_map_prompt = """
Eres una IA especializada en transformar cualquier texto en un MAPA CONCEPTUAL.

Devuelve SIEMPRE un único bloque Markdown con este formato:

```conceptmap
# Título del tema
- Concepto 1
  - Subconcepto 1
  - Subconcepto 2
- Concepto 2
  - Subconcepto 1
  - Subconcepto 2
Reglas:
No agregues texto fuera del bloque.
No agregues explicaciones.
No uses emojis.
Usa entre 2 y 5 conceptos principales y entre 1 y 4 subconceptos.
"""

@app.route('/ask', methods=['POST'])
def ask():
    global conversation_history

    data = request.get_json(force=True)
    user_msg = data.get('message', '').strip()
    model_name = data.get("model", "eslobar-5")

    if not user_msg:
        return jsonify({"reply": "(mensaje vacío)"}), 200

    try:
        # Guardamos el mensaje del usuario
        conversation_history.append({"role": "user", "content": user_msg})
        conversation_history = conversation_history[-MAX_HISTORY:]

        # Preparamos mensajes del historial
        messages_for_model = [
            {"role": m["role"], "content": m["content"]}
            for m in conversation_history
        ]

        # Modelo real usado (siempre gpt-5)
        openai_model = "gpt-5"

        # Construir el "mensaje completo" según modo
        messages_for_model_full = []

        if model_name == "eslobar-0b":
            messages_for_model_full.append({
                "role": "system",
                "content": concept_map_prompt
            })
        else:
            messages_for_model_full.append({
                "role": "system",
                "content": "Eres Eslobar, un asistente académico claro, organizado y útil."
            })

        # Agregar conversación
        messages_for_model_full.extend(messages_for_model)

        # Llamada al modelo
        resp = client.responses.create(
            model=openai_model,
            input=messages_for_model_full,
        )

        reply = resp.output_text

        # Guardamos respuesta
        conversation_history.append({"role": "assistant", "content": reply})
        conversation_history = conversation_history[-MAX_HISTORY:]

        return jsonify({"reply": reply})

    except Exception as e:
        return jsonify({"reply": f"Error: {e}"}), 500




# =============================
# NUEVA RUTA: /action
# Genera la frase corta tipo:
# "explicando la revolución rusa"
# =============================
@app.route('/action', methods=['POST', 'OPTIONS'])
def action():
    # Preflight CORS: el navegador manda OPTIONS antes del POST
    if request.method == 'OPTIONS':
        # Flask-CORS ya mete los headers, devolvemos 200 vacío
        return ('', 200)

    data = request.get_json(silent=True) or {}
    user_msg = data.get("message", "").strip()

    if not user_msg:
        # Por si llega vacío
        return jsonify({"action": "Procesando…", "description": ""}), 200

    try:
        # Prompt: pedimos 2 líneas, una corta y una descripción
        action_prompt = (
            "Eres una IA que, a partir del mensaje del usuario, genera:\n"
            "1) Una frase muy corta que describa la tarea que realizarás,\n"
            "   en GERUNDIO (explicando, resumiendo, analizando...), máximo 8 palabras.\n"
            "2) Una breve descripción de lo que vas a hacer, en una o dos oraciones, "
            "   como si explicaras tu plan de trabajo.\n\n"
            "REGLAS:\n"
            "- Responde en español.\n"
            "- NO uses comillas ni emojis.\n"
            "- Primera línea: SOLO la frase corta.\n"
            "- Segunda línea: SOLO la descripción breve.\n"
            "- Exactamente dos líneas y nada más.\n\n"
            f"Mensaje del usuario: \"{user_msg}\"\n\n"
            "Devuelve solo las dos líneas."
        )

        resp = client.responses.create(
            model="gpt-4o-mini",  # modelo rápido y barato para esto
            input=action_prompt,
        )

        full_text = (resp.output_text or "").strip()

        # Separamos líneas y limpiamos
        lines = [l.strip() for l in full_text.splitlines() if l.strip()]
        short = lines[0] if len(lines) >= 1 else ""
        desc  = lines[1] if len(lines) >= 2 else ""

        # Limitamos la frase corta a 8 palabras por seguridad
        if short:
            words = short.split()
            if len(words) > 8:
                short = " ".join(words[:8])
        else:
            short = "Procesando…"

        if not desc:
            # Fallback simple si no vino descripción
            desc = f"El usuario pide: {user_msg[:120]}"

        return jsonify({"action": short, "description": desc}), 200

    except Exception as e:
        print("ACTION ERROR:", e)
        # Si falla la IA, que no rompa nada:
        return jsonify({
            "action": "Procesando…",
            "description": ""
        }), 200



@app.route('/stt', methods=['POST'])
def stt():
    if "audio" not in request.files:
        return jsonify({"error": "No audio file"}), 400

    audio_file = request.files["audio"]

    try:
        # Transcripción usando Whisper de OpenAI
        transcript = client.audio.transcriptions.create(
            model="whisper-1",
            file=audio_file,
            language="es",
            response_format="json"
        )

        text = transcript.text if hasattr(transcript, "text") else ""
        return jsonify({"text": text})

    except Exception as e:
        print("STT Error:", e)
        return jsonify({"error": "Transcription failed"}), 500


# 🔻 CATCH-ALL PARA ESTÁTICOS (AL FINAL SIEMPRE)
@app.route('/<path:path>', methods=['GET'])
def assets(path):
    return send_from_directory('.', path)


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=int(os.getenv("PORT", 8080)))








