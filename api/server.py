from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from openai import OpenAI
import os

app = Flask(__name__, static_folder='static')
CORS(app)

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

@app.route('/')
def root():
    return send_from_directory('.', 'index.html')

@app.route('/<path:path>')
def assets(path):
    return send_from_directory('.', path)

@app.route('/ask', methods=['POST'])
def ask():
    data = request.get_json(force=True)
    user_msg = data.get('message','').strip()
    model = data.get('model', 'gpt-5')  # <- viene del selector

    if not user_msg:
        return jsonify({"reply":"(mensaje vacío)"}), 200

    try:
        PROMPT_ID = "pmpt_691b7fed2d988197b948b6e5bee1bcde0c795e0d75914fa9"  # <-- tu ID

        resp = client.responses.create(
            model=model,
            prompt={
                "id": PROMPT_ID,
                "version": "5"   # O la versión que quieras usar
            },
            input=user_msg,
            temperature=0.4
        )
        reply = resp.output_text
        return jsonify({"reply": reply})
    except Exception as e:
        return jsonify({"reply": f"Error: {e}"}), 500


# =============================
# NUEVA RUTA: /action
# Genera la frase corta tipo:
# "explicando la revolución rusa"
# =============================
@app.route('/action', methods=['POST'])
def action():
    data = request.get_json(force=True)
    user_msg = data.get("message", "").strip()

    if not user_msg:
        # Por si llega vacío
        return jsonify({"action": "Procesando…"}), 200

    try:
        # Prompt súper simple: una sola llamada al modelo mini
        action_prompt = (
            "Eres una IA que resume la TAREA que vas a realizar "
            "a partir del mensaje del usuario.\n\n"
            "REGLAS:\n"
            "- Responde en español.\n"
            "- Máximo 8 palabras.\n"
            "- Usa gerundio: 'explicando...', 'resumiendo...', 'buscando...', etc.\n"
            "- No uses comillas, ni emojis, ni punto final.\n\n"
            f"Mensaje del usuario: \"{user_msg}\"\n\n"
            "Responde SOLO con la frase corta."
        )

        resp = client.responses.create(
            model="gpt-4o-mini",  # modelo rápido y barato para esto
            input=action_prompt,
            temperature=0.2
        )

        text = (resp.output_text or "").strip()

        # Por seguridad, recortamos a 8 palabras máximo
        words = text.split()
        if len(words) > 8:
            text = " ".join(words[:8])

        if not text:
            text = "Procesando tu pedido…"

        return jsonify({"action": text}), 200

    except Exception as e:
        print("ACTION ERROR:", e)
        # Si falla la IA, que no rompa nada:
        return jsonify({"action": "Procesando…"}), 200


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


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=int(os.getenv("PORT", 8080)))




















