from flask import Flask, request, jsonify
from flask_cors import CORS
from openai import OpenAI
import os

app = Flask(__name__)
CORS(app)

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

@app.post("/ask")
def ask():
    data = request.json

    # ChatKit envía { messages: [...] }
    messages = data.get("messages", [])

    # Llamamos a OpenAI
    completion = client.chat.completions.create(
        model="gpt-5",
        messages=messages,
        stream=False
    )

    assistant_msg = completion.choices[0].message

    # *** FORMATO QUE NECESITA CHATKIT ***
    return jsonify({
        "output": {
            "message": {
                "role": assistant_msg.role,
                "content": assistant_msg.content
            }
        }
    })

if __name__ == "__main__":
    app.run(port=5000)
