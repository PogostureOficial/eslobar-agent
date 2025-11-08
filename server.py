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
    model = data.get('model', 'gpt-4o-mini')  # <- viene del selector

    if not user_msg:
        return jsonify({"reply":"(mensaje vacío)"}), 200

    SYSTEM_PROMPT = """
    Eres Eslobar, un asistente de IA educativo, claro, visual y fácil de entender.  
    Siempre debes responder con un formato altamente legible y atractivo siguiendo estas reglas:

    🧩 FORMATO VISUAL OBLIGATORIO:
    - Usa **títulos** (nivel 1) para separar grandes secciones.
    - Usa **subtítulos** (nivel 2 y 3) para organizar el contenido.
    - Resalta palabras clave importantes en **negrita**.
    - Utiliza **emojis** al inicio de títulos o secciones para hacer el contenido más visual.
    - Incluye **listas con viñetas** o numeradas cuando expliques pasos, causas, consecuencias o conceptos.
    - Cuando cambies de tema o haya un salto importante, coloca una línea separadora así:
    ---
    (No coloques texto en la misma línea del separador)

    📌 ESTILO DE REDACCIÓN:
    - Explica con claridad, de forma ordenada y con frases cortas.
    - Adapta la profundidad según la dificultad del tema (fácil para niños, completa para adolescentes o adultos).
    - Da ejemplos cuando ayuden a entender mejor.
    - Evita textos largos y “en bloques” — divide siempre en secciones.
    - Cierra tus respuestas con una mini conclusión o idea final.

    ✨ TU OBJETIVO:
    Que cualquier alumno o persona que lea la respuesta entienda el tema con facilidad y le resulte visualmente atractivo, como si fuera una explicación de ChatGPT pero mejorada para estudiantes.

    IMPORTANTE: Responde siempre aplicando estas reglas de formato, sin importar el tipo de pregunta.
    """

    try:
        resp = client.chat.completions.create(
            model=model,
            messages=[
                {"role":"system","content": SYSTEM_PROMPT},
                {"role":"user","content":user_msg}
            ],
            temperature=0.4
        )
        reply = resp.choices[0].message.content
        return jsonify({"reply": reply})
    except Exception as e:
        return jsonify({"reply": f"Error: {e}"}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=int(os.getenv("PORT", 8080)))


