#!/usr/bin/env python3
"""
Copywriting Assistant Web App - Flask backend with Claude API integration.
"""

import os
import json
import sys

from flask import Flask, request, Response, jsonify, send_from_directory
import anthropic

from config import MODEL, MAX_TOKENS, SYSTEM_PROMPT

app = Flask(__name__, static_folder="static")

# In-memory session store (per-server-process; fine for single-user tool)
sessions = {}


def get_client():
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise RuntimeError("ANTHROPIC_API_KEY environment variable is not set.")
    return anthropic.Anthropic(api_key=api_key)


@app.route("/")
def index():
    return send_from_directory("static", "index.html")


@app.route("/api/chat", methods=["POST"])
def chat():
    """Send a message and stream back the response."""
    data = request.get_json()
    session_id = data.get("session_id", "default")
    user_message = data.get("message", "").strip()

    if not user_message:
        return jsonify({"error": "Empty message"}), 400

    if session_id not in sessions:
        sessions[session_id] = []

    sessions[session_id].append({"role": "user", "content": user_message})

    def generate():
        try:
            client = get_client()
            full_response = []

            with client.messages.stream(
                model=MODEL,
                max_tokens=MAX_TOKENS,
                system=SYSTEM_PROMPT,
                messages=sessions[session_id],
            ) as stream:
                for text in stream.text_stream:
                    full_response.append(text)
                    yield f"data: {json.dumps({'type': 'text', 'content': text})}\n\n"

            assistant_message = "".join(full_response)
            sessions[session_id].append(
                {"role": "assistant", "content": assistant_message}
            )
            yield f"data: {json.dumps({'type': 'done'})}\n\n"

        except Exception as e:
            # Remove the failed user message
            if sessions.get(session_id):
                sessions[session_id].pop()
            yield f"data: {json.dumps({'type': 'error', 'content': str(e)})}\n\n"

    return Response(generate(), mimetype="text/event-stream")


@app.route("/api/upload", methods=["POST"])
def upload_file():
    """Upload a data file and return its contents."""
    if "file" not in request.files:
        return jsonify({"error": "No file provided"}), 400

    file = request.files["file"]
    if file.filename == "":
        return jsonify({"error": "No file selected"}), 400

    try:
        content = file.read().decode("utf-8")
        return jsonify({
            "filename": file.filename,
            "content": content,
            "characters": len(content),
        })
    except UnicodeDecodeError:
        return jsonify({"error": "File must be a text file (UTF-8)"}), 400


@app.route("/api/clear", methods=["POST"])
def clear_session():
    """Clear conversation history for a session."""
    data = request.get_json()
    session_id = data.get("session_id", "default")
    sessions[session_id] = []
    return jsonify({"status": "cleared"})


@app.route("/api/export", methods=["POST"])
def export_conversation():
    """Export the conversation as a text file."""
    data = request.get_json()
    session_id = data.get("session_id", "default")
    messages = sessions.get(session_id, [])

    lines = []
    for msg in messages:
        role = "YOU" if msg["role"] == "user" else "COPY CHIEF"
        lines.append(f"--- {role} ---\n{msg['content']}\n")

    return jsonify({"conversation": "\n".join(lines)})


if __name__ == "__main__":
    if not os.environ.get("ANTHROPIC_API_KEY"):
        print("ERROR: Set ANTHROPIC_API_KEY environment variable first.")
        print("  export ANTHROPIC_API_KEY='your-key-here'")
        sys.exit(1)

    print("\n  Copywriting Assistant running at http://localhost:5000\n")
    app.run(debug=True, port=5000)
