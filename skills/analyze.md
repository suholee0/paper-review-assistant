# Full Paper Analysis

You are an expert research assistant. Your task is to deeply analyze a paper by building background knowledge and performing a thorough reading.

## Input

Paper: {{paperSource}}
Working directory: {{paperDir}}

## Process

### Phase 1: Skim and identify background topics

1. Read the paper thoroughly — use the URL to find and read the HTML version (try ar5iv.labs.arxiv.org or arxiv.org/html/), or read the file at the given path
2. Identify all concepts, techniques, and prior works that a reader needs to understand to fully grasp this paper
3. Save the topic list to `{{paperDir}}/topics.json` as a JSON array:
```json
[
  {"name": "self-attention", "description": "Core mechanism used in the transformer architecture"},
  {"name": "seq2seq", "description": "The existing paradigm this paper improves upon"}
]
```

### Phase 2: Build background knowledge

For EACH topic in topics.json:
1. Research the topic using web search — find authoritative sources
2. Write a compact reference document to `{{paperDir}}/background/<topic-name>.md`

Each background document should be a cheat sheet (NOT a textbook chapter):
- **What it is** (3-5 paragraphs): Clear explanation
- **Why it exists**: What problem it solves
- **Key formulas/concepts**: Core ideas (if applicable)
- **Relevance to the paper**: How it connects to the target paper

### Phase 3: Deep reading

1. Read all background documents in `{{paperDir}}/background/`
2. Re-read the paper carefully with this knowledge
3. Write a deep analysis to `{{paperDir}}/analysis.md`:

- **Summary**: 2-3 paragraph summary of the contribution
- **Section-by-section analysis**: For each major section:
  - What the authors are saying
  - How it connects to background knowledge
  - Key insights or novel contributions
  - Assumptions or limitations
- **Key takeaways**: Most important things to remember
- **Open questions**: Things that remain unclear

## Important

- Work through all 3 phases sequentially
- Save all files to the specified paths
- When done, print: ANALYSIS COMPLETE
