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


@app.route('/ask', methods=['POST'])
def ask():
    global conversation_history

    data = request.get_json(force=True)
    user_msg = data.get('message', '').strip()
    model = data.get('model', 'gpt-5')

    if not user_msg:
        return jsonify({"reply": "(mensaje vacío)"}), 200

    try:
        # 1) Guardamos el mensaje del usuario en la memoria
        conversation_history.append({"role": "user", "content": user_msg})
        conversation_history = conversation_history[-MAX_HISTORY:]

        # 2) Armamos la conversación para el modelo
        messages_for_model = []
        for m in conversation_history:
            messages_for_model.append({
                "role": m["role"],
                "content": m["content"]
            })

        # 3) Llamamos al modelo con contexto
        resp = client.responses.create(
            model=model,
            prompt={
                "id": "pmpt_691b7fed2d988197b948b6e5bee1bcde0c795e0d75914fa9",
                "version": "7"
            },
            input=messages_for_model,
            temperature=0.4
        )

        reply = resp.output_text

        # 4) Guardamos también la respuesta de la IA
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
            temperature=0.2
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





