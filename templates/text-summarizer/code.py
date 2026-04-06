import json
import re
import math
from collections import Counter


def run(text, num_sentences=5):
    """Summarize text using extractive TF-IDF sentence scoring."""
    # Split into sentences
    sentences = re.split(r'(?<=[.!?])\s+', text.strip())
    sentences = [s.strip() for s in sentences if len(s.strip()) > 10]

    if len(sentences) <= num_sentences:
        return {"result": json.dumps({
            "summary": " ".join(sentences),
            "sentence_count": len(sentences),
            "original_sentences": len(sentences),
            "note": "Text is already short enough, returned as-is.",
        }, indent=2)}

    # Tokenize
    stop_words = {
        "the", "a", "an", "in", "on", "at", "to", "for", "of", "and", "or",
        "but", "is", "are", "was", "were", "be", "been", "being", "have",
        "has", "had", "do", "does", "did", "will", "would", "could", "should",
        "may", "might", "shall", "can", "this", "that", "these", "those",
        "it", "its", "i", "me", "my", "we", "our", "you", "your", "he",
        "she", "him", "her", "his", "they", "them", "their", "with", "from",
        "by", "as", "not", "no", "so", "if", "then", "than", "also", "very",
        "just", "about", "up", "out", "into", "over", "after", "before",
    }

    def tokenize(s):
        words = re.findall(r'\b[a-z]+\b', s.lower())
        return [w for w in words if w not in stop_words and len(w) > 2]

    # Term frequency per sentence
    sentence_tokens = [tokenize(s) for s in sentences]

    # Document frequency
    df = Counter()
    for tokens in sentence_tokens:
        for word in set(tokens):
            df[word] += 1

    n_docs = len(sentences)

    # Score each sentence by TF-IDF sum
    scores = []
    for i, tokens in enumerate(sentence_tokens):
        if not tokens:
            scores.append(0.0)
            continue
        tf = Counter(tokens)
        score = 0.0
        for word, count in tf.items():
            idf = math.log(n_docs / (1 + df[word]))
            score += (count / len(tokens)) * idf
        # Slight boost for earlier sentences (position bias)
        position_factor = 1.0 / (1.0 + 0.1 * i)
        scores.append(score * position_factor)

    # Select top sentences, preserve original order
    ranked = sorted(range(len(scores)), key=lambda i: scores[i], reverse=True)
    selected = sorted(ranked[:num_sentences])

    summary = " ".join(sentences[i] for i in selected)

    return {"result": json.dumps({
        "summary": summary,
        "sentence_count": len(selected),
        "original_sentences": len(sentences),
        "compression_ratio": round(len(selected) / len(sentences), 2),
    }, indent=2)}
