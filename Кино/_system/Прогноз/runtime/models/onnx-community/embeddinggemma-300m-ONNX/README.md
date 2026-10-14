---
license: gemma
base_model:
- google/embeddinggemma-300m
pipeline_tag: sentence-similarity
library_name: transformers.js
tags:
- text-embeddings-inference
---

# EmbeddingGemma model card

**Model Page**: [EmbeddingGemma](https://ai.google.dev/gemma/docs/embeddinggemma)

**Resources and Technical Documentation**:

*   [Responsible Generative AI Toolkit](https://ai.google.dev/responsible)
*   [EmbeddingGemma on Kaggle](https://www.kaggle.com/models/google/embeddinggemma/)
*   [EmbeddingGemma on Vertex Model Garden](https://console.cloud.google.com/vertex-ai/publishers/google/model-garden/embeddinggemma)

**Terms of Use**: [Terms](https://ai.google.dev/gemma/terms)

**Authors**: Google DeepMind

## Model Information

### Description

EmbeddingGemma is a 300M parameter, state-of-the-art for its size, open embedding model from Google, built from Gemma 3 (with T5Gemma initialization) and the same research and technology used to create Gemini models. EmbeddingGemma produces vector representations of text, making it well-suited for search and retrieval tasks, including classification, clustering, and semantic similarity search. This model was trained with data in 100+ spoken languages.

The small size and on-device focus makes it possible to deploy in environments with limited resources such as mobile phones, laptops, or desktops, democratizing access to state of the art AI models and helping foster innovation for everyone.

### Inputs and outputs

-   **Input:**
    -   Text string, such as a question, a prompt, or a document to be embedded
    -   Maximum input context length of 2048 tokens

-   **Output:**
    -   Numerical vector representations of input text data
    -   Output embedding dimension size of 768, with smaller options available (512, 256, or 128) via Matryoshka Representation Learning (MRL). MRL allows users to truncate the output embedding of size 768 to their desired size and then re-normalize for efficient and accurate representation.

### Usage

These model weights are designed to be used with [Transformers.js](https://huggingface.co/docs/transformers.js/en/index).

**NOTE**: EmbeddingGemma activations do not support `fp16` or its derivatives. Please use `fp32`, `q8`, or `q4` as appropriate for your hardware.

#### Transformers.js in JavaScript

```js
import { AutoModel, AutoTokenizer, matmul } from "@huggingface/transformers";

// Download from the 🤗 Hub
const model_id = "onnx-community/embeddinggemma-300m-ONNX";
const tokenizer = await AutoTokenizer.from_pretrained(model_id);
const model = await AutoModel.from_pretrained(model_id, {
  dtype: "fp32", // Options: "fp32" | "q8" | "q4".
});

// Run inference with queries and documents
const prefixes = {
  query: "task: search result | query: ",
  document: "title: none | text: ",
};
const query = prefixes.query + "Which planet is known as the Red Planet?";
const documents = [
  "Venus is often called Earth's twin because of its similar size and proximity.",
  "Mars, known for its reddish appearance, is often referred to as the Red Planet.",
  "Jupiter, the largest planet in our solar system, has a prominent red spot.",
  "Saturn, famous for its rings, is sometimes mistaken for the Red Planet.",
].map((x) => prefixes.document + x);

const inputs = await tokenizer([query, ...documents], { padding: true });
const { sentence_embedding } = await model(inputs);

// Compute similarities to determine a ranking
const scores = await matmul(sentence_embedding, sentence_embedding.transpose(1, 0));
const similarities = scores.tolist()[0].slice(1);
console.log(similarities);
// [ 0.30109718441963196, 0.6358831524848938, 0.4930494725704193, 0.48887503147125244 ]

// Convert similarities to a ranking
const ranking = similarities.map((score, index) => ({ index, score })).sort((a, b) => b.score - a.score);
console.log(ranking);
// [
//   { index: 1, score: 0.6358831524848938 },
//   { index: 2, score: 0.4930494725704193 },
//   { index: 3, score: 0.48887503147125244 },
//   { index: 0, score: 0.30109718441963196 }
// ]
```

#### Using the ONNX Runtime in Python

```py
from huggingface_hub import hf_hub_download
import onnxruntime as ort
from transformers import AutoTokenizer

# Download from the 🤗 Hub
model_id = "onnx-community/embeddinggemma-300m-ONNX"
model_path = hf_hub_download(model_id, subfolder="onnx", filename="model.onnx") # Download graph
hf_hub_download(model_id, subfolder="onnx", filename="model.onnx_data") # Download weights
session = ort.InferenceSession(model_path)
tokenizer = AutoTokenizer.from_pretrained(model_id)

# Run inference with queries and documents
prefixes = {
  "query": "task: search result | query: ",
  "document": "title: none | text: ",
}
query = prefixes["query"] + "Which planet is known as the Red Planet?"
documents = [
    "Venus is often called Earth's twin because of its similar size and proximity.",
    "Mars, known for its reddish appearance, is often referred to as the Red Planet.",
    "Jupiter, the largest planet in our solar system, has a prominent red spot.",
    "Saturn, famous for its rings, is sometimes mistaken for the Red Planet."
]
documents = [prefixes["document"] + x for x in documents]

inputs = tokenizer([query] + documents, padding=True, return_tensors="np")

_, sentence_embedding = session.run(None, inputs.data)
print(sentence_embedding.shape)  # (5, 768)

# Compute similarities to determine a ranking
query_embeddings = sentence_embedding[0]
document_embeddings = sentence_embedding[1:]
similarities = query_embeddings @ document_embeddings.T
print(similarities)  # [0.30109745 0.635883 0.49304956 0.48887485]

# Convert similarities to a ranking
ranking = similarities.argsort()[::-1]
print(ranking)  # [1 2 3 0]
```

#### Using the ONNX Runtime in Text Embeddings Inference (TEI)

```bash
docker run -p 8080:80 \
    ghcr.io/huggingface/text-embeddings-inference:cpu-1.8.1 \
    --model-id onnx-community/embeddinggemma-300M-ONNX \
    --dtype float32 \
    --pooling mean
```

## Model Data

### Training Dataset

This model was trained on a dataset of text data that includes a wide variety of sources totaling approximately 320 billion tokens. Here are the key components:

-   **Web Documents**: A diverse collection of web text ensures the model is exposed to a broad range of linguistic styles, topics, and vocabulary. The training dataset includes content in over 100 languages.
-   **Code and Technical Documents**: Exposing the model to code and technical documentation helps it learn the structure and patterns of programming languages and specialized scientific content, which improves its understanding of code and technical questions.
-   **Synthetic and Task-Specific Data**: Synthetically training data helps to teach the model specific skills. This includes curated data for tasks like information retrieval, classification, and sentiment analysis, which helps to fine-tune its performance for common embedding applications.

The combination of these diverse data sources is crucial for training a powerful multilingual embedding model that can handle a wide variety of different tasks and data formats.

### Data Preprocessing

Here are the key data cleaning and filtering methods applied to the training data:

-   CSAM Filtering: Rigorous CSAM (Child Sexual Abuse Material) filtering was applied at multiple stages in the data preparation process to ensure the exclusion of harmful and illegal content.
-   Sensitive Data Filtering: As part of making Gemma pre-trained models safe and reliable, automated techniques were used to filter out certain personal information and other sensitive data from training sets.
-   Additional methods: Filtering based on content quality and safety in line with [our policies](https://ai.google/static/documents/ai-responsibility-update-published-february-2025.pdf).

## Model Development

### Hardware

EmbeddingGemma was trained using the latest generation of [Tensor Processing Unit (TPU)](https://cloud.google.com/tpu/docs/intro-to-tpu) hardware (TPUv5e), for more details refer to the [Gemma 3 model card](https://ai.google.dev/gemma/docs/core/model_card_3).

### Software

Training was done using [JAX](https://github.com/jax-ml/jax) and [ML Pathways](https://blog.google/technology/ai/introducing-pathways-next-generation-ai-architecture/). For more details refer to the [Gemma 3 model card](https://ai.google.dev/gemma/docs/core/model_card_3).

## Evaluation

### Benchmark Results

The model was evaluated against a large collection of different datasets and metrics to cover different aspects of text understanding.

#### Full Precision Checkpoint

<table>
  <thead>
    <tr>
      <th colspan="3"><strong>MTEB (Multilingual, v2)</strong></th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><strong>Dimensionality</strong></td>
      <td><strong>Mean (Task)</strong></td>
      <td><strong>Mean (TaskType)</strong></td>
    </tr>
    <tr>
      <td>768d</td>
      <td>61.15</td>
      <td>54.31</td>
    </tr>
    <tr>
      <td>512d</td>
      <td>60.71</td>
      <td>53.89</td>
    </tr>
    <tr>
      <td>256d</td>
      <td>59.68</td>
      <td>53.01</td>
    </tr>
    <tr>
      <td>128d</td>
      <td>58.23</td>
      <td>51.77</td>
    </tr>
  </tbody>
</table>

<table>
  <thead>
    <tr>
      <th colspan="3"><strong>MTEB (English, v2)</strong></th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><strong>Dimensionality</strong></td>
      <td><strong>Mean (Task)</strong></td>
      <td><strong>Mean (TaskType)</strong></td>
    </tr>
    <tr>
      <td>768d</td>
      <td>68.36</td>
      <td>64.15</td>
    </tr>
    <tr>
      <td>512d</td>
      <td>67.80</td>
      <td>63.59</td>
    </tr>
    <tr>
      <td>256d</td>
      <td>66.89</td>
      <td>62.94</td>
    </tr>
    <tr>
      <td>128d</td>
      <td>65.09</td>
      <td>61.56</td>
    </tr>
  </tbody>
</table>

<table>
  <thead>
    <tr>
      <th colspan="3"><strong>MTEB (Code, v1)</strong></th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><strong>Dimensionality</strong></td>
      <td><strong>Mean (Task)</strong></td>
      <td><strong>Mean (TaskType)</strong></td>
    </tr>
    <tr>
      <td>768d</td>
      <td>68.76</td>
      <td>68.76</td>
    </tr>
    <tr>
      <td>512d</td>
      <td>68.48</td>
      <td>68.48</td>
    </tr>
    <tr>
      <td>256d</td>
      <td>66.74</td>
      <td>66.74</td>
    </tr>
    <tr>
      <td>128d</td>
      <td>62.96</td>
      <td>62.96</td>
    </tr>
  </tbody>
</table>

#### QAT Checkpoints

<table>
  <thead>
    <tr>
      <th colspan="3"><strong>MTEB (Multilingual, v2)</strong></th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><strong>Quant config (dimensionality)</strong></td>
      <td><strong>Mean (Task)</strong></td>
      <td><strong>Mean (TaskType)</strong></td>
    </tr>
    <tr>
      <td>Q4_0 (768d)</td>
      <td>60.62</td>
      <td>53.61</td>
    </tr>
    <tr>
      <td>Q8_0 (768d)</td>
      <td>60.93</td>
      <td>53.95</td>
    </tr>
    <tr>
      <td>Mixed Precision* (768d)</td>
      <td>60.69</td>
      <td>53.82</td>
    </tr>
  </tbody>
</table>

<table>
  <thead>
    <tr>
      <th colspan="3"><strong>MTEB (English, v2)</strong></th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><strong>Quant config (dimensionality)</strong></td>
      <td><strong>Mean (Task)</strong></td>
      <td><strong>Mean (TaskType)</strong></td>
    </tr>
    <tr>
      <td>Q4_0 (768d)</td>
      <td>67.91</td>
      <td>63.64</td>
    </tr>
    <tr>
      <td>Q8_0 (768d)</td>
      <td>68.13</td>
      <td>63.85</td>
    </tr>
    <tr>
      <td>Mixed Precision* (768d)</td>
      <td>67.95</td>
      <td>63.83</td>
    </tr>
  </tbody>
</table>

<table>
  <thead>
    <tr>
      <th colspan="3"><strong>MTEB (Code, v1)</strong></th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><strong>Quant config (dimensionality)</strong></td>
      <td><strong>Mean (Task)</strong></td>
      <td><strong>Mean (TaskType)</strong></td>
    </tr>
    <tr>
      <td>Q4_0 (768d)</td>
      <td>67.99</td>
      <td>67.99</td>
    </tr>
    <tr>
      <td>Q8_0 (768d)</td>
      <td>68.70</td>
      <td>68.70</td>
    </tr>
    <tr>
      <td>Mixed Precision* (768d)</td>
      <td>68.03</td>
      <td>68.03</td>
    </tr>
  </tbody>
</table>

Note: QAT models are evaluated after quantization

\* Mixed Precision refers to per-channel quantization with int4 for embeddings, feedforward, and projection layers, and int8 for attention (e4_a8_f4_p4).

### Prompt Instructions

EmbeddingGemma can generate optimized embeddings for various use cases—such as document retrieval, question answering, and fact verification—or for specific input types—either a query or a document—using prompts that are prepended to the input strings.
Query prompts follow the form `task: {task description} | query: ` where the task description varies by the use case, with the default task description being `search result`. Document-style prompts follow the form `title: {title | "none"} | text: ` where the title is either `none` (the default) or the actual title of the document. Note that providing a title, if available, will improve model performance for document prompts but may require manual formatting.

Use the following prompts based on your use case and input data type. These may already be available in the EmbeddingGemma configuration in your modeling framework of choice.

<table>
  <thead>
    <tr>
      <th><br>
<strong>Use Case (task type enum)</strong></th>
      <th><br>
<strong>Descriptions</strong></th>
      <th><br>
<strong>Recommended Prompt</strong></th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><br>
Retrieval (Query)</td>
      <td rowspan="4"><br>
Used to generate embeddings that are optimized for document search or information retrieval</td>
      <td><br>
task: search result | query: {content}</td>
    </tr>
    <tr>
      <td><br>
Retrieval (Document)</td>
      <td><br>
title: {title | "none"} | text: {content}</td>
    </tr>
    <tr>
      <td><br>
Question Answering</td>
      <td><br>
task: question answering | query: {content}</td>
    </tr>
    <tr>
      <td><br>
Fact Verification</td>
      <td><br>
task: fact checking | query: {content}</td>
    </tr>
    <tr>
      <td><br>
Classification</td>
      <td><br>
Used to generate embeddings that are optimized to classify texts according to preset labels</td>
      <td><br>
task: classification | query: {content}</td>
    </tr>
    <tr>
      <td><br>
Clustering</td>
      <td><br>
Used to generate embeddings that are optimized to cluster texts based on their similarities</td>
      <td><br>
task: clustering | query: {content}</td>
    </tr>
    <tr>
      <td><br>
Semantic Similarity</td>
      <td><br>
Used to generate embeddings that are optimized to assess text similarity. This is not intended for retrieval use cases.</td>
      <td><br>
task: sentence similarity | query: {content}</td>
    </tr>
    <tr>
      <td><br>
Code Retrieval</td>
      <td><br>
Used to retrieve a code block based on a natural language query, such as <em>sort an array</em> or <em>reverse a linked list</em>. Embeddings of the code blocks are computed using retrieval_document.</td>
      <td><br>
task: code retrieval | query: {content}</td>
    </tr>
  </tbody>
</table>

## Usage and Limitations

These models have certain limitations that users should be aware of.

### Intended Usage

Open embedding models have a wide range of applications across various industries and domains. The following list of potential uses is not comprehensive. The purpose of this list is to provide contextual information about the possible use-cases that the model creators considered as part of model training and development.

-   **Semantic Similarity**: Embeddings optimized to assess text similarity, such as recommendation systems and duplicate detection
-   **Classification**: Embeddings optimized to classify texts according to preset labels, such as sentiment analysis and spam detection
-  **Clustering**: Embeddings optimized to cluster texts based on their similarities, such as document organization, market research, and anomaly detection
-   **Retrieval**
    -   **Document**: Embeddings optimized for document search, such as indexing articles, books, or web pages for search
    -   **Query**: Embeddings optimized for general search queries, such as custom search
    -   **Code Query**: Embeddings optimized for retrieval of code blocks based on natural language queries, such as code suggestions and search

-   **Question Answering**: Embeddings for questions in a question-answering system, optimized for finding documents that answer the question, such as chatbox.
-   **Fact Verification**: Embeddings for statements that need to be verified, optimized for retrieving documents that contain evidence supporting or refuting the statement, such as automated fact-checking systems.

### Limitations

-   Training Data
    -   The quality and diversity of the training data significantly influence the model's capabilities. Biases or gaps in the training data can lead to limitations in the model's responses.
    -   The scope of the training dataset determines the subject areas the model can handle effectively.

-   Language Ambiguity and Nuance
    -   Natural language is inherently complex. Models might struggle to grasp subtle nuances, sarcasm, or figurative language.

### Ethical Considerations and Risks

Risks identified and mitigations:

-   **Perpetuation of biases**: It's encouraged to perform continuous monitoring (using evaluation metrics, human review) and the exploration of de-biasing techniques during model training, fine-tuning, and other use cases.
-   **Misuse for malicious purposes**: Technical limitations and developer and end-user education can help mitigate against malicious applications of embeddings. Educational resources and reporting mechanisms for users to flag misuse are provided. Prohibited uses of Gemma models are outlined in the [Gemma Prohibited Use Policy](https://ai.google.dev/gemma/prohibited_use_policy).
-   **Privacy violations**: Models were trained on data filtered for removal of certain personal information and other sensitive data. Developers are encouraged to adhere to privacy regulations with privacy-preserving techniques.

### Benefits

At the time of release, this family of models provides high-performance open embedding model implementations designed from the ground up for responsible AI development compared to similarly sized models. Using the benchmark evaluation metrics described in this document, these models have shown superior performance to other, comparably-sized open model alternatives.