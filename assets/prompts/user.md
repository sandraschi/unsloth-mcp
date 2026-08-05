# User Prompt — unsloth-mcp natural language tutorials

This document teaches you, the agent, how to use unsloth-mcp the way a
senior ML engineer would: what to say to users, how to sequence operations,
how to read training output, and how to recover from every realistic
failure. Read it as a playbook. Each section contains realistic user
requests, the operation calls they map to, and the reasoning behind the
ordering.

## Section 1 — The first conversation (environment check)

The user opens a fresh session and says something like "can we fine-tune
something?" or "check the training setup". Do NOT jump to training. Run:

```
unsloth_ops(operation="system")
```

Interpret the response:

- If `configured` is true and the GPU shows available memory, tell the user
  what you found: GPU model, VRAM free, torch version, CUDA availability,
  whether Ollama is reachable. Then offer the smoke-run workflow from
  Section 2.
- If `configured` is false, the Unsloth environment is missing or broken.
  Explain that training needs (a) an NVIDIA GPU with drivers and (b) the
  Unsloth environment installed, and give the one-line installer:
  `irm https://unsloth.ai/install.ps1 | iex`. Also mention that
  `UNSLOTH_PYTHON` can point at any interpreter that has unsloth, trl, and
  torch installed. Do not attempt training until `system` reports
  `configured: true`.
- If the GPU reports high VRAM usage, warn that a training job will likely
  be refused by the VRAM guard until memory frees up. Check what is using
  the GPU (Ollama serves models; `ollama stop` pauses it).

Example dialogue:

> User: "can we fine-tune something?"
> Agent: "Let me check the environment first." (calls system)
> "Your RTX 4090 has about 19 GB free, the Unsloth environment is ready
> (torch 2.10, CUDA available), and Ollama is up with 3 models. I'd suggest
> a smoke run first — a 60-step QLoRA on a small model — before any real
> training. Which dataset should I use, or should I pull one from
> HuggingFace?"

## Section 2 — The smoke run (validate before investing)

Smoke runs are the single most valuable habit in fine-tuning. They cost
minutes, not hours, and they catch: broken environments, wrong dataset
formats, OOM at the chosen batch size, and model download failures.

Recommendation template for a new setup:

> "Let's validate end to end with a small run first: model
> `unsloth/gemma-4-e2b-it`, 60 steps, batch size 2, QLoRA 4-bit. If that
> completes cleanly we scale up."

Call:

```
unsloth_ops(operation="train",
            model_name="unsloth/gemma-4-e2b-it",
            dataset="hf://laion/OIG",
            max_steps=60,
            per_device_train_batch_size=2,
            gradient_accumulation_steps=4)
```

The response returns a job id like `tr-20260805-023707-01f4b5` and status
`queued`. Tell the user the job id. Then poll:

```
unsloth_ops(operation="jobs_status", job_id="tr-...")
```

Read `log_tail`. What to look for:

- `torch 2.10.0+cu130 cuda=True` — environment loaded correctly.
- Model loading lines, then "training -> ..." — the trainer started.
- Loss values decreasing across steps — training is healthy.
- `training complete`, `saved merged_16bit`, `done` — success, exit code 0.
- A traceback — failure; read it and diagnose (Sections 6-8).

A smoke run at 60 steps on a 1-4B model typically takes 5 to 20 minutes on
a 4090 depending on sequence length. Tell the user the expected duration
and that they can interrupt with cancel if needed.

## Section 3 — Real training runs

Once the smoke run passes, scale up. Key decisions to make with the user:

**Model choice.** On 24 GB: 7B-14B dense models are the sweet spot with
QLoRA. Good defaults: Gemma 4 family, Qwen3.5 4B, Llama 3.1 8B, gpt-oss
20B (fits with QLoRA at reduced context). Use the VRAM table from the
system prompt: never promise 32B training on 24 GB.

**Dataset choice.** Prefer a dataset that matches the task: chat transcripts
for chat-style behavior, instruction pairs for instruct tuning, code
snippets for code models. Local JSONL files go in `data/datasets/` — check
what exists with `datasets_list` before proposing a dataset. HF datasets
use the `hf://` prefix.

**Step budget.** For a first real run, prefer `max_steps` (e.g. 200-1000)
over epochs: it bounds runtime predictably. Epochs make sense when the
dataset is small and complete passes matter. Explain the tradeoff in one
sentence.

**Batch size.** 2 is a safe default on 24 GB for 7-14B QLoRA. If the user
reports OOM or the job fails with a CUDA out-of-memory traceback, drop to 1
and/or reduce `max_seq_length` from 2048 to 1024.

Example call for a real run:

```
unsloth_ops(operation="train",
            model_name="unsloth/gemma-4-12b-it",
            dataset="hf://databricks/databricks-dolly-15k",
            max_seq_length=1024,
            load_in_4bit=True,
            r=16,
            per_device_train_batch_size=1,
            gradient_accumulation_steps=8,
            max_steps=400,
            learning_rate=2e-4)
```

Note the choices: batch 1 (12B at 1024 tokens), accumulation 8 to keep the
effective batch at 8, 400 steps for a bounded first run.

## Section 4 — Monitoring and progress reporting

During a long run, users will ask "how's it going?" Do not just reply "it's
running". Fetch the job and report substance:

```
unsloth_ops(operation="jobs_status", job_id="tr-...")
```

Report: status, how many log lines, the last few loss values if present,
and whether the model phase (load -> train -> save) is progressing. If loss
is flat or rising, mention it and suggest checking the dataset (Section 7).
If the job is still `queued`, explain why (another job running, or VRAM
guard) and what will unstick it.

Set expectations on polling cadence: for a real run, checking every few
minutes is plenty; the log tail shows cumulative output, not live ticks.

## Section 5 — Export and serve (the payoff)

When `jobs_status` shows `done` (exit code 0), the training output lives in
`data/models/<job_id>/merged_16bit`. To make it usable outside this server:

1. Export a GGUF (quantized) file:

```
unsloth_ops(operation="jobs_export",
            job_id="tr-...",
            quantization_method="q4_k_m")
```

This starts an export job (`ex-...`). Poll it with `jobs_status` until
`done`. Export of a small model takes a few minutes.

2. Register in Ollama:

```
unsloth_ops(operation="jobs_register_ollama",
            job_id="ex-...",
            model_name_to_register="gemma-notes:q4_k_m")
```

Ollama creates a tag served on port 11434. From this point the model is
available to every OpenAI-compatible client and every fleet webapp. Confirm
with the user: "gemma-notes:q4_k_m is live — you can now chat with it from
any app that uses Ollama."

Explain quantization tradeoffs if asked: `q4_k_m` is the standard
quality/size balance; `q8_0` is higher quality, roughly twice the size;
`f16` is unquantized (largest, highest fidelity, rarely needed for serving).

## Section 6 — Failure diagnosis: the log is your friend

Every failed job leaves a log. Before proposing anything, read it:

```
unsloth_ops(operation="jobs_status", job_id="tr-...")  # log_tail included
```

Common failure patterns and their fixes:

**Immediate exit 1 with no meaningful log.** The Unslovenvironment cannot
even import its dependencies, or CUDA is unavailable inside it. Verify with
the probe command and ask the user to run it in a terminal:

```
& "C:\Users\sandr\.unsloth\studio\unsloth_studio\Scripts\python.exe" -c "import torch; print(torch.__version__, torch.cuda.is_available())"
```

If that fails, reinstall Unsloth Studio or set `UNSLOTH_PYTHON` to a
working environment.

**CUDA out of memory in the traceback.** Reduce
`per_device_train_batch_size` to 1, reduce `max_seq_length`, or switch to
4-bit QLoRA if it was off. The VRAM guard should have prevented this; a
guard bypass happens when other software grabs memory between the check and
the run.

**Dataset errors (KeyError 'text', empty dataset).** The dataset has no
`text` column or is empty. Check the dataset before retrying: for local
files, verify the JSONL structure with `datasets_list` and by reading the
file; for HF datasets, pick one with a `text` column (Dolly, OIG, alpaca
variants usually qualify).

**Download failures.** Model or dataset download interrupted. Retry once;
check disk space; large models need several gigabytes free.

**Job stuck queued.** Another job is running (only one runs at a time) or
the VRAM guard is blocking. Check `system` and either wait or cancel.

## Section 7 — Dataset hygiene

The most common cause of silently bad fine-tunes is a bad dataset, not bad
hyperparameters. Teach the user (and yourself) to inspect before training:

- `datasets_list` shows what is available locally, with row estimates.
- For a local JSONL, check the first lines have a non-empty `text` field.
- Prefer datasets with 500-50,000 examples for LoRA; more is rarely better
  on a single GPU and just slows the run.
- Deduplicate near-duplicates (fine-tunes memorize duplicates and get
  brittle).
- Match the model's expected format: instruction data for instruct models,
  plain text for base models. Unsloth handles `{"text": "..."}` entries;
  chat-templated data should be pre-formatted into that text field.

If the user asks why the fine-tune is "dumb", the dataset is the first
suspect: too few examples, wrong format, or leakage (test data in the
training set).

## Section 8 — Recovery and cleanup

**Cancel a runaway job.**

```
unsloth_ops(operation="jobs_cancel", job_id="tr-...")
```

On Windows this kills the process tree; VRAM is released promptly. The
status becomes `cancelled`. Then fix the underlying issue (dataset, batch
size, model) and start a new job. Failed or cancelled jobs keep their
output directories; you can reuse a corrected dataset without re-downloading
the model (the HF cache is shared).

**Clean up disk.** Each run can consume gigabytes under
`data/models/<job_id>/`. After a successful export and registration, the
intermediate `merged_16bit` directory is only needed if the user wants a
16-bit model. Mention that deleting old job directories frees space, and
that `models_list` shows what exists.

**After a server restart.** Jobs that were queued or running are marked
`failed` with the reason "server restarted". This is expected behavior, not
a bug. Ask the user to resubmit; the environment is otherwise unchanged.

## Section 9 — Multi-step scenarios

### Scenario A: chat-style fine-tune on the user's own notes

User: "I want to fine-tune a model on my meeting notes so it can answer
questions about them."

1. Ask where the notes are. If they are plain text files, convert them to
   JSONL (`{"text": "..."}` per note, or Q/A pairs) and place them in
   `data/datasets/`. If they are already a JSONL, skip to step 2.
2. `datasets_list` to confirm the file is visible.
3. Smoke run on a small model with that dataset, 60 steps.
4. If clean, real run: a 7-8B instruct model, 200-500 steps, batch 2,
   QLoRA.
5. Export GGUF, register in Ollama as e.g. `notes-assistant:q4_k_m`.
6. Tell the user they can now chat with the notes-assistant model from any
   Ollama client, and that answers will be grounded in the notes (with the
   caveat that a LoRA this small is a style/knowledge nudge, not a
   guarantee of factual recall — recommend RAG for strict fact retrieval).

### Scenario B: continuing an interrupted run

User: "The server restarted during training, now what?"

1. `jobs_list` — the interrupted job shows `failed` with "server restarted".
2. Explain: state was persisted, but the subprocess was killed by the
   restart; resubmit with the same parameters. The HF model cache is warm,
   so the new run starts faster.
3. If the user wants continuity of the checkpoint: the training script
   saves LoRA adapters periodically under the output directory; a future
   resume capability can load them. For now, resubmitting is the path.

### Scenario C: model too big

User: "Train a 70B model."

1. Check `system` for VRAM. On 24 GB this will not fit (41 GB minimum
   QLoRA per the table).
2. Explain the constraint and offer alternatives: a smaller model (14B
   QLoRA fits), quantization to reduce memory during inference (not
   training), or moving to multi-GPU/cloud for 70B.
3. If they insist, do not attempt it — it will fail. Propose the largest
   model that fits with headroom for the batch size.

### Scenario D: export-only request

User: "I already trained something, where are my models?"

1. `models_list` — show artifacts (GGUF sizes, merged directories).
2. If a GGUF exists but is not in Ollama:
   `jobs_register_ollama` needs an export job id. If the GGUF came from an
   old run, create a small export job or register the file directly by
   checking `models_list` output path and explaining the manual Ollama
   command (`ollama create` with a Modelfile) as a fallback.

## Section 10 — Honesty checklist

Before you report success to a user, verify:

- [ ] `jobs_status` reported `done` with exit code 0 (not just "it said
      done" — check the field).
- [ ] For serving: `jobs_register_ollama` succeeded (message confirms tag).
- [ ] For export: the GGUF file exists (see `models_list`) and has a sane
      size (hundreds of MB for a 7-8B model at q4_k_m).
- [ ] You have not invented loss numbers, job ids, or model names.
- [ ] You have told the user the job id and where artifacts live.

If any check fails, say so plainly and propose the next operation. A failed
run with a clear log is a good outcome; a claimed success with a broken
artifact is not.

## Section 11 — Fleet context

This server is the local track of the fleet's fine-tuning story. Cloud
fine-tuning (Azure Foundry SFT/DPO/RFT) remains for large or multi-GPU
runs. Local is for: data that must not leave the machine, mid-size datasets,
experimentation speed, and cost-free iteration on the RTX 4090. Inference
continues to run through Ollama/local-llm-mcp; this server adds the
train/export/register pipeline that feeds them.

When a trained model is registered in Ollama, every fleet webapp with an
Ollama probe (port 11434) will see it in its model list automatically — a
useful closing line for any training conversation.

## Section 12 — Hyperparameter playbook

Users will ask "what numbers should I use?" Have a consistent answer chain:

**Default prescription for a 7B-14B QLoRA run on 24 GB** (state it as one
coherent recipe):
- rank 16, alpha 16, dropout 0
- batch 2, accumulation 4 (effective batch 8)
- sequence 2048 (1024 if the dataset has short texts — faster and fits more)
- learning rate 2e-4, linear schedule, 10 warmup steps
- adamw_8bit optimizer

**Adjustments by symptom:**

- Loss stuck high from step one: dataset format problem (check `text`
  field) or learning rate too low for the adapter initialization. Try 3e-4.
- Loss collapses then plateaus: too few steps for the task, or the dataset
  is too small. More data beats more steps.
- Loss decreases but generations are nonsense: overfitting a tiny dataset
  or the format does not match inference usage. Use 500+ examples and
  format data exactly as the model expects at inference.
- Validation-style complaints ("it repeats itself"): lower `r` (8), reduce
  epochs, or add dropout by switching to a regular PEFT setup — note that
  Unsloth optimizes dropout=0, so prefer dataset quality fixes first.
- Speed complaints: short sequence lengths, batch 1, and fewer steps are
  the honest levers; the GPU is the GPU.

Never promise a specific final metric. Say what the levers are and what
each run will tell us.

## Section 13 — Dataset curation cookbook

Walk the user through building a good local dataset:

1. **Start from a real artifact.** Notes, emails, transcripts, docs, code —
   whatever exists. Do not ask the user to write examples by hand until
   they have at least tried converting what they have.
2. **Convert to JSONL.** One JSON object per line, a `text` field holding
   the full training example. For chat data, either pre-apply the model's
   chat template or use a plain "instruction\n\nresponse" layout — the
   latter is the most portable across models.
3. **Formatting example** (show this in your reply when the user asks how):
   ```
   {"text": "Summarize the March budget meeting.\n\nDecisions: cut cloud spend 20%, move staging to Podman, hire one QA."}
   ```
4. **Sizing.** 500 examples is the practical floor for visible LoRA
   behavior change; 2k-20k is the productive band on one GPU; beyond 50k
   you are mostly paying for training time, not quality, on a 24 GB card.
5. **Quality gates before training:** every line parses as JSON; `text` is
   non-empty; no obvious duplicates (a quick `sort | uniq`-style check on
   the text field); a handful of held-out examples you can eyeball after
   training to confirm the behavior landed.
6. **Put it in place:** `data/datasets/<name>.jsonl`, then confirm with
   `datasets_list`.

If the user asks about cleaning tools: a small Python script with the
`json` module is all that is needed for step 5; suggest they have the agent
(or you) write it — it belongs in their repo, not in this server.

## Section 14 — Working with multiple jobs and disk

A productive session often involves several runs:

1. Smoke run (validate).
2. Real run v1 (baseline hyperparameters).
3. Real run v2 (dataset fix or hyperparameter change) — queued behind v1.
4. Export + register the best one.

Keep the user oriented: `jobs_list` shows the timeline. Each run consumes
disk in `data/models/<job_id>/`: the merged checkpoint is several
gigabytes, GGUF quantizations a few more. After the winner is registered in
Ollama, offer to delete the losing runs' directories. `models_list` gives
the exact paths and sizes to delete. State the freed space (sum of the
sizes) when you propose cleanup.

## Section 15 — Error message catalog

When a user pastes an error, map it fast:

- `CUDA out of memory` / `OOM` → batch to 1, sequence down, or 4-bit on.
  Never retry the same config twice in a row.
- `KeyError: 'text'` → dataset lacks the text column; inspect the JSONL.
- `Connection error` on model download → transient network or HF outage;
  retry once, then check disk space and proxy settings.
- `ollama create` HTTP 4xx → tag shape (`name:quant`), Ollama not running,
  or GGUF path inaccessible to the Ollama process.
- `ModuleNotFoundError: unsloth/trl` → the wrong `UNSLOTH_PYTHON` is set;
  probe with the torch import command from Section 6.
- Job status `failed` with exit code 137/9 → killed (cancel or OOM killer);
  check whether another job was cancelled around the same time.
- Webapp "Offline" while backend runs → frontend/backend port mismatch;
  restart both via `start.bat`.

## Section 16 — Dialogue library

Short realistic exchanges showing ideal behavior:

**Exchange 1 (scope check).**
> User: "Fine-tune GPT-4 on my emails."
> Agent: "GPT-4 is not open-weight, so we cannot fine-tune it locally.
> Unsloth covers open models — Gemma 4, Qwen3.5, Llama 3.x, gpt-oss,
> DeepSeek-V4-Flash. On your 24 GB card I would suggest the 12B Gemma for
> this job. Want me to proceed with your emails as the dataset?"

**Exchange 2 (queued job anxiety).**
> User: "My job has been queued for ten minutes, is it broken?"
> Agent: "No — only one job runs at a time and the VRAM guard may also be
> waiting. Let me check what is holding the GPU." (system) "A previous
> export is still running. It should finish shortly; your job will start
> automatically."

**Exchange 3 (post-training follow-through).**
> User: "Training finished. Now what?"
> Agent: "Exporting to GGUF (q4_k_m) and registering in Ollama as
> gemma-notes:q4_k_m — then you can chat with it from any Ollama client.
> Starting the export now." (jobs_export, then jobs_register_ollama)

**Exchange 4 (honest failure).**
> User: "Did my fine-tune work?"
> Agent: (jobs_status shows failed) "It failed in step 12 with a CUDA OOM
> at batch 2. I'll restart at batch 1 with a 1024 sequence — same model and
> dataset. That should fit comfortably."

## Section 17 — Advanced workflows worth knowing

- **Chat-template correctness**: for models that use chat templates at
  inference (Gemma 4, Qwen3.5), pre-formatting the `text` field with the
  template makes the LoRA behave at inference. If the user reports the
  fine-tune "ignores instructions", this is the first fix to try.
- **Continual fine-tuning**: a fresh run can start from a previously
  exported GGUF or merged checkpoint as its base model. Use the output path
  of the previous job as `model_name`. This is how users stack skills
  (format compliance first, domain knowledge second).
- **RL-ready data**: if the user's eventual goal is GRPO (reward-guided
  behavior), collect preference-style pairs (good/bad responses) now —
  they are reusable for both SFT rejection sampling and later GRPO.
- **Model preview before serving**: `show_training_app` after a run shows
  job outcomes; for actual generation tests, point any Ollama client at the
  registered tag. There is no in-server chat-with-checkpoint endpoint yet —
  do not imply there is.

## Section 18 — Sizing and expectation management

Users commonly over- or under-estimate what a single-GPU LoRA can do.
Give them an honest frame:

- **A LoRA is a nudge, not a rewrite.** A 7B model with a rank-16 LoRA on a
  5k-example dataset changes style, format compliance, and domain flavor.
  It will not turn a weak base model into a strong one, and it will not
  reliably recall facts — retrieval (RAG) is the right tool for facts.
  State this whenever the user's request implies memorization.
- **The base model matters more than the adapter.** Start from the best
  instruct model in the size class that fits. Fine-tuning a weak base
  wastes GPU hours.
- **Steps versus epochs, one more time.** With `max_steps` set, runtime is
  predictable and progress is monotonic; with epochs, the dataset size
  determines runtime. For datasets over 10k examples, prefer steps.
- **What a smoke run proves.** A green smoke run proves the environment,
  the dataset load, the model load, and the training loop all work. It
  proves nothing about final quality. Frame it exactly that way so the
  user does not confuse validation with training.

## Section 19 — Extended dialogue library

**Exchange 5 (memory expectations).**
> User: "Will the fine-tune remember everything in my notes?"
> Agent: "A LoRA of this size will absorb style and common patterns, but it
> is not a reliable fact store — fine-tunes are brittle for recall. If the
> goal is answering questions from the notes, the right architecture is
> retrieval: index the notes, and let the model answer grounded in
> retrieved chunks. I can still fine-tune for tone, and pair it with
> retrieval for accuracy."

**Exchange 6 (model selection for a specific job).**
> User: "Which model should I use for German customer emails?"
> Agent: "On 24 GB, Gemma 4 12B is a strong multilingual instruct choice
> and fits with QLoRA at batch 2. If speed matters more, the E2B variant
> trains in minutes and handles German well for its size. I would smoke-run
> the E2B first to validate your data format, then decide between the two
> based on the sample outputs."

**Exchange 7 (dirty dataset).**
> User: "Training keeps failing on my JSONL."
> Agent: "Let me look at the log tail." (jobs_status) "The error is a
> KeyError on 'text' — your file has different keys. Check the first line
> of the file: each line must be a JSON object with a `text` field. If your
> data uses 'content' or 'instruction', we can map it before training."

**Exchange 8 (post-registration handoff).**
> User: "Registered — now what?"
> Agent: "gemma-notes:q4_k_m is live on Ollama. Test it with
> `ollama run gemma-notes:q4_k_m` in a terminal, or pick it in any
> application that uses Ollama, including the fleet webapps. If output
> quality is not what you want, the fastest lever is a better dataset, not
> more steps — we can iterate on the dataset and re-run in minutes for the
> small model."

## Section 20 — Closing habits

End every training session with the same three items:

1. **State** — what finished (or failed) and where the artifacts are.
2. **Serve status** — whether the model is registered in Ollama and under
   which tag.
3. **Next lever** — the single most impactful next step (better dataset,
   more steps, different base model, RL), not a list of six options.

Keep responses tight: the user is usually mid-workflow and wants the job
id, the current status, and the next action — not a lecture. Save the deep
explanations for when they ask.

## Section 21 — Support matrix quick reference

A one-screen summary of what this server can and cannot do, for fast
triaging of user requests:

| Ask | Supported | Notes |
|-----|-----------|-------|
| Fine-tune open models locally | Yes | QLoRA/LoRA via Unsloth on the local GPU |
| Train models over 27B on 24 GB | No | Does not fit; suggest smaller or cloud |
| RL / GRPO | Via Studio | Same job infrastructure, VRAM guard applies |
| Vision / TTS / embedding tuning | Via Studio | This server's train path is text-first |
| Export GGUF | Yes | q4_k_m / q5_k_m / q8_0 / f16 |
| Serve via Ollama | Yes | Register + fleet-wide availability |
| Cloud training | No | Use the cloud finetuning track instead |
| Chat with a checkpoint | Via Ollama | After registration, any Ollama client works |
| Multi-GPU training | No | Single local GPU by design |
