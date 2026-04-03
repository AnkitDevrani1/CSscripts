#!/usr/bin/env python3
"""
Copywriting Assistant - Your AI Copy Chief powered by Claude.

Share your data (audience research, product info, brand guidelines, etc.)
and get expert copywriting help, critique, and education.
"""

import os
import sys
import argparse
from pathlib import Path

import anthropic
from rich.console import Console
from rich.markdown import Markdown
from rich.panel import Panel

from config import MODEL, MAX_TOKENS, SYSTEM_PROMPT, WELCOME_MESSAGE

console = Console()


def create_client():
    """Create the Anthropic client, checking for API key."""
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        console.print(
            "[bold red]Error:[/bold red] ANTHROPIC_API_KEY environment variable is not set.\n"
            "Set it with: export ANTHROPIC_API_KEY='your-key-here'"
        )
        sys.exit(1)
    return anthropic.Anthropic(api_key=api_key)


def load_file(filepath):
    """Load content from a file and return it as a formatted string."""
    path = Path(filepath).expanduser().resolve()
    if not path.exists():
        console.print(f"[red]File not found:[/red] {path}")
        return None
    if not path.is_file():
        console.print(f"[red]Not a file:[/red] {path}")
        return None

    try:
        content = path.read_text(encoding="utf-8")
        console.print(f"[green]Loaded:[/green] {path.name} ({len(content):,} characters)")
        return f"[Data loaded from file: {path.name}]\n\n{content}"
    except Exception as e:
        console.print(f"[red]Error reading file:[/red] {e}")
        return None


def save_conversation(filepath, messages):
    """Save the conversation history to a file."""
    path = Path(filepath).expanduser().resolve()
    try:
        lines = []
        for msg in messages:
            role = "YOU" if msg["role"] == "user" else "COPY CHIEF"
            lines.append(f"--- {role} ---\n{msg['content']}\n")
        path.write_text("\n".join(lines), encoding="utf-8")
        console.print(f"[green]Conversation saved to:[/green] {path}")
    except Exception as e:
        console.print(f"[red]Error saving:[/red] {e}")


def send_message(client, messages):
    """Send messages to Claude and stream the response."""
    full_response = []

    with client.messages.stream(
        model=MODEL,
        max_tokens=MAX_TOKENS,
        system=SYSTEM_PROMPT,
        messages=messages,
    ) as stream:
        console.print()
        for text in stream.text_stream:
            console.print(text, end="", highlight=False)
            full_response.append(text)
        console.print("\n")

    return "".join(full_response)


def run_interactive(client, initial_files=None):
    """Run the interactive copy chief session."""
    console.print(Markdown("---"))
    console.print(WELCOME_MESSAGE)
    console.print(Markdown("---"))

    messages = []

    # Load any initial files provided via CLI
    if initial_files:
        file_contents = []
        for filepath in initial_files:
            content = load_file(filepath)
            if content:
                file_contents.append(content)

        if file_contents:
            combined = "\n\n".join(file_contents)
            user_msg = f"Here is my data to work with:\n\n{combined}"
            messages.append({"role": "user", "content": user_msg})
            console.print(
                f"\n[bold cyan]Copy Chief is reviewing your {len(file_contents)} file(s)...[/bold cyan]"
            )
            response = send_message(client, messages)
            messages.append({"role": "assistant", "content": response})

    while True:
        try:
            console.print("[bold cyan]You:[/bold cyan] ", end="")
            user_input = input().strip()
        except (EOFError, KeyboardInterrupt):
            console.print("\n[dim]Goodbye![/dim]")
            break

        if not user_input:
            continue

        # Handle commands
        if user_input.lower() == "/quit":
            console.print("[dim]Goodbye![/dim]")
            break

        if user_input.lower() == "/clear":
            messages.clear()
            console.print("[yellow]Conversation cleared. Share your data to start fresh.[/yellow]")
            continue

        if user_input.lower().startswith("/save"):
            parts = user_input.split(maxsplit=1)
            if len(parts) < 2:
                console.print("[red]Usage: /save <filepath>[/red]")
            else:
                save_conversation(parts[1], messages)
            continue

        if user_input.lower().startswith("/load"):
            parts = user_input.split(maxsplit=1)
            if len(parts) < 2:
                console.print("[red]Usage: /load <filepath>[/red]")
                continue
            content = load_file(parts[1])
            if content:
                user_input = f"Here is additional data:\n\n{content}"
            else:
                continue

        # Send to Claude
        messages.append({"role": "user", "content": user_input})
        console.print("\n[bold cyan]Copy Chief:[/bold cyan]")

        try:
            response = send_message(client, messages)
            messages.append({"role": "assistant", "content": response})
        except anthropic.APIError as e:
            console.print(f"[red]API Error:[/red] {e}")
            messages.pop()  # Remove the failed user message


def run_single(client, prompt, data_files=None):
    """Run a single (non-interactive) query and exit."""
    messages = []

    # Load data files if provided
    parts = []
    if data_files:
        for filepath in data_files:
            content = load_file(filepath)
            if content:
                parts.append(content)

    if parts:
        full_prompt = f"Here is my data:\n\n{''.join(parts)}\n\nMy request: {prompt}"
    else:
        full_prompt = prompt

    messages.append({"role": "user", "content": full_prompt})

    try:
        response = send_message(client, messages)
    except anthropic.APIError as e:
        console.print(f"[red]API Error:[/red] {e}")
        sys.exit(1)


def main():
    parser = argparse.ArgumentParser(
        description="Copywriting Assistant - Your AI Copy Chief powered by Claude",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Interactive mode
  python copy_chief.py

  # Interactive mode with data files pre-loaded
  python copy_chief.py -f audience.txt -f product_brief.md

  # Single query mode
  python copy_chief.py -p "Write a headline for a SaaS landing page" -f product_data.txt

  # Review copy from a file
  python copy_chief.py -p "Review this copy and tell me what's wrong" -f draft.txt
        """,
    )
    parser.add_argument(
        "-f", "--file",
        action="append",
        dest="files",
        metavar="FILE",
        help="Data file(s) to load (can specify multiple: -f file1.txt -f file2.txt)",
    )
    parser.add_argument(
        "-p", "--prompt",
        type=str,
        help="Single prompt to run (non-interactive mode). If omitted, starts interactive session.",
    )
    parser.add_argument(
        "--model",
        type=str,
        default=None,
        help=f"Override the Claude model (default: {MODEL})",
    )

    args = parser.parse_args()

    if args.model:
        import config
        config.MODEL = args.model

    client = create_client()

    if args.prompt:
        run_single(client, args.prompt, args.files)
    else:
        run_interactive(client, args.files)


if __name__ == "__main__":
    main()
