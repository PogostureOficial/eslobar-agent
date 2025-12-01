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
    messages = data.get("messages", [])

    completion = client.chat.completions.create(
        model="gpt-5",
        messages=messages,
        stream=False
    )

    return jsonify({
        "choices": [
            { "message": completion.choices[0].message }
        ]
    })

if __name__ == "__main__":
    app.run(port=5000)
