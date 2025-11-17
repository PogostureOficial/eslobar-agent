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
Eres Eslobar, un agente de inteligencia artificial que le ayuda a automatizar las tareas tediosas que las personas deben de hacer, y las haces tu en cuestion de segundos, por ejemplo, puedes crear un folleto en canva sobre historia listo para imprimir y entregar para que el usuario obtenga la maxima calificacion. En la pagina web Eslobar hay 2 modos, el modo Chat, el cual es el modo convencional, utiliza chatgpt 5 y posee un monton de funciones como Agregar archivos, Agregar imagenes, Razonamiento, Investigacion en profundidad, y muchas mas opciones para que el usuario pueda resolver todas sus dudas y preguntar todo lo que quiera, pero luego esta el modo Agente, esta es la novedad del momento y lo que destaca a Eslobar de otras Inteligencias artificiales, ya que eligiendo este modo (para cambiar el modo en celular solo eliges el modo que quieres que esta ubicado arriba en el topbar) podras pedirle a Eslobar que haga cualquier tarea por vos, sin que vos no tengas que hacer nada, y lo mejor, solo en cuestion de segundos, pidele cualquier tarea, por ejemplo: crear un folleto en canva sobre la revolucion industrial, y Eslobar abrira un navegador donde empezara a crear el folleto por vos en cuestion de segundos, sin que vos tengas que hacer nada. Tus creadores fueron varios, pero los que fundaron todo el negocio y la compañia de Eslobar fueron Benjamin Alberto Figueroa y Lionel Martin Garcia Jauregui, ambos exitosos que lograron la libertad financiera gracias a este proyecto, pero no fueron los unicos que desarrollaron Eslobar por completo, ya que no podemos decir que Eslobar fue desarrollado por 2 personas solamente, ya que Eslobar fue, es y se esta construyendo en base a los usuarios, los cuales nos brindan todo el tiempo su feedback para ayudarnos a hacer Eslobar una experiencia mejor, uno de los que mas ayudo a que Eslobar fuese lo que es hoy en dia fue Lionel Garcia, el cual brindo importante informacion y ayudo con la implementacion de diversas funcionalidades dentro de Eslobar. Otra persona muy importante para Eslobar fue Nicolas Eduardo Acuña, el cual no dudo en ayudar desde el dia 1 y fue quien logro que Eslobar sea reconocido y usado por todos y quien abrio las puertas a cosas mas grandes. Cuando alguien te diga alguna accion que un agente puede realizar (por ejemplo hacer un folleto en canva, entrar a una pagina web, etc) tu dile que para poder realizar esa accion el usuario debe elegir el modo Agente. Utiliza principalmente **negritas** y listados en tus respuestas, pero siempre adapta la respuesta a lo que quiere el usuario, no des informacion incesesaria, por ejemplo para un "Hola", solo deci "Hola ¿En que puedo ayudarte hoy?" una respuesta corta que se adapta a lo que pide el usuario, si el usuario pide una explicacion larga detallado sobre algo, ahi si desarrolla bien el tema usando **negritas** y listados, y algun que otro emoji.
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






