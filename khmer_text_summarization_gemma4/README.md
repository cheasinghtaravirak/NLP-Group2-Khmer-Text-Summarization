# Khmer Text Summarization with Gemma 4 (4B) + LR-Sum

Fine-tuning **Google Gemma-4-E4B-it** on the **LR-Sum Khmer dataset** for abstractive text summarization in Khmer, using QLoRA (4-bit quantization + LoRA adapters) on Google Colab.

---

## Prerequisites

| Requirement | Details |
|---|---|
| **Platform** | Google Colab (recommended: A100 80GB GPU) |
| **Hugging Face Account** | Required — Gemma 4 is a gated model |
| **Google Drive** | Used to save model checkpoints and the fused model |

### Hugging Face Access

Gemma 4 requires you to accept the model license before use:

1. Visit [google/gemma-4-E4B-it](https://huggingface.co/google/gemma-4-E4B-it) on Hugging Face.
2. Accept the license agreement.
3. Generate a Hugging Face access token at [huggingface.co/settings/tokens](https://huggingface.co/settings/tokens).
4. In Colab, run the following before starting the notebook and paste your token when prompted:

```python
from huggingface_hub import login
login()
```

---

## Getting Started

### 1. Upload to Google Colab

- Go to [colab.research.google.com](https://colab.research.google.com).
- Select **File → Upload notebook** and upload `Gemma_4_4B_+_LR_Sum_(Khmer).ipynb`.

### 2. Select a GPU Runtime

- Go to **Runtime → Change runtime type**.
- Set **Hardware accelerator** to **A100 GPU** (recommended for this model size).

### 3. Mount Google Drive

Add and run this cell at the top of the notebook before running any other cells:

```python
from google.colab import drive
drive.mount('/content/drive')
```

This is required because checkpoints and the final merged model are saved to `/content/drive/MyDrive/`.

### 4. Run the Notebook Cells in Order

The notebook is structured as the following sequential steps:

| Step | Description |
|---|---|
| **Install dependencies** | Installs `bitsandbytes`, `transformers`, `peft`, `trl`, `accelerate`, `datasets`, and `torchao`. |
| **Load model (QLoRA)** | Loads `google/gemma-4-E4B-it` in 4-bit NF4 quantization to fit within GPU memory. |
| **Load & format dataset** | Downloads the Khmer subset (`khm`) of [bltlab/lr-sum](https://huggingface.co/datasets/bltlab/lr-sum) and formats it into Gemma's instruction-tuning format. |
| **Tokenize** | Tokenizes the formatted dataset with a max sequence length of 1024. |
| **Configure LoRA** | Applies LoRA adapters (`r=16`, `lora_alpha=32`) to all linear layers for parameter-efficient fine-tuning. |
| **Train** | Runs up to 500 steps using `paged_adamw_8bit`, saving checkpoints every 100 steps to `gemma-4-4b-khmer-sum/`. |
| **Test inference** | Summarizes a sample long Khmer article using the trained model. |
| **Save adapter** | Saves the LoRA adapter and tokenizer to Google Drive. |
| **Merge & push** | Merges the LoRA weights into the base model and optionally pushes the fused model to your Hugging Face Hub repository. |
| **Advanced inference** | Runs the fused model with a structured prompt that generates meeting minutes or article summaries in Khmer. |

---

## Dataset

- **Name:** LR-Sum (Low-Resource Summarization)
- **Source:** `bltlab/lr-sum` on Hugging Face
- **Language:** Khmer (`khm`)
- **Splits used:** `train` and `validation`
- **Format:** Each example contains a `text` (article) and a `summary` field.

---

## Model Output

After training and merging, the model can produce two types of structured Khmer summaries:

- **Article/document summary** — A concise overview with a bulleted list of key facts.
- **Meeting minutes** — A formatted output with sections for Objective, Key Discussion Points, Decisions, and Action Items.

---

## Saving & Sharing the Model

- **Checkpoints** are saved during training to `gemma-4-4b-khmer-sum/` in the Colab working directory.
- **The LoRA adapter** is saved to `/content/drive/MyDrive/gemma-4-4b-khmer-sum`.
- **The fused (merged) model** is saved to `/content/drive/MyDrive/gemma-4-4b-khmer-lr-sum-fused`.
- To **push to Hugging Face Hub**, update the `hf_repo_name` variable in the merge cell to your own repository name (e.g., `your-username/gemma-4-4b-khmer-sum`) and run the push step.

---

## Hardware Notes

- **A100 (80GB):** Can increase `max_seq_length` to 2048 for better results on long articles.
- **T4 (16GB):** Reduce `per_device_train_batch_size` to 1 and `max_length` to 512 to avoid OOM errors.
