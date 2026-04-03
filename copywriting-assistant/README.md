# Copywriting Assistant (Copy Chief)

An AI-powered copywriting assistant that acts as your personal Copy Chief — powered by Claude.

## What It Does

- **Analyzes your data** — Share audience research, product info, brand guidelines, competitor analysis, testimonials, and more. The Copy Chief deeply understands your context before writing or critiquing.
- **Critiques your copy** — Get honest, specific feedback on what doesn't work and *why*, grounded in proven copywriting principles (AIDA, PAS, 4 U's, etc.).
- **Writes & rewrites copy** — Headlines, landing pages, emails, ads, and more — all grounded in the data you provide.
- **Educates you** — Explains the principles behind every suggestion so you improve over time.

## Setup

### 1. Install dependencies

```bash
cd copywriting-assistant
pip install -r requirements.txt
```

### 2. Set your API key

```bash
export ANTHROPIC_API_KEY='your-anthropic-api-key'
```

## Usage

### Interactive Mode (recommended)

```bash
python copy_chief.py
```

Share your data first, then ask for copy or feedback.

### Pre-load Data Files

```bash
python copy_chief.py -f audience_research.txt -f product_brief.md
```

### Single Query Mode

```bash
python copy_chief.py -p "Write 5 headlines for a SaaS landing page" -f product_data.txt
```

### Review Existing Copy

```bash
python copy_chief.py -p "Review this copy and tell me what's wrong" -f my_draft.txt
```

### Override Model

```bash
python copy_chief.py --model claude-opus-4-6
```

## Interactive Commands

| Command | Description |
|---|---|
| `/load <file>` | Load a data file mid-session |
| `/save <file>` | Save the conversation to a file |
| `/clear` | Clear conversation and start fresh |
| `/quit` | Exit |

## How to Get the Best Results

1. **Share data first** — The more context you provide (audience, product, competitors, tone), the better the output.
2. **Be specific** — "Write a headline" is okay. "Write a headline for busy CTOs who need to reduce cloud costs" is much better.
3. **Iterate** — Push back on suggestions, ask "why", request alternatives. The best copy comes from revision.
4. **Load files** — Use `-f` to load research docs, briefs, or drafts directly.

## Critique Framework

The Copy Chief evaluates copy against:

- **Clarity** — Can the reader understand the message in one read?
- **Specificity** — Are there concrete details, or is it vague?
- **Proof** — Are claims backed by evidence?
- **Audience Fit** — Does it match how the target audience speaks?
- **Emotional Hook** — Does it tap into a real desire or fear?
- **CTA Strength** — Is there a clear, compelling next step?
- **Flow** — Does each line earn the next?
- **Uniqueness** — Could a competitor use this copy as-is?
