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
    # sirve archivos estáticos desde /static y otros
    return send_from_directory('.', path)

@app.route('/ask', methods=['POST'])
def ask():
    data = request.get_json(force=True)
    user_msg = data.get('message','').strip()
    personality = data.get('personality','generic')

    if not user_msg:
        return jsonify({"reply":"(mensaje vacío)"}), 200

    # Prompt muy simple para MVP
    system = "Eres un asistente útil, claro y conciso. Responde en español."
    if personality == 'generic':
        pass
    else:
        system += " Habla como un experto ejecutor de tareas."

    try:
        resp = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role":"system","content":system},
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
