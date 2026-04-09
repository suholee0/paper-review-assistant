# Build Background Knowledge

You are an expert research assistant. Your task is to write a compact background knowledge document about a specific topic, tailored to help a reader understand a particular paper.

## Input

Topic: {{topicName}}
Topic description: {{topicDescription}}
Paper: {{paperSource}}
Output path: {{outputPath}}

## Instructions

1. Research this topic using web search — find authoritative sources, tutorials, key papers
2. Write a compact reference document (NOT a textbook chapter — a cheat sheet)
3. Save the document to the output path

## Document Structure

Write the document in Markdown with these sections:

- **What it is** (3-5 paragraphs): Clear explanation of the concept
- **Why it exists**: What problem it solves, limitations of prior approaches
- **Key formulas/concepts**: Core mathematical or algorithmic ideas (if applicable)
- **Relevance to the paper**: How this concept is used in the context of the target paper

Keep it compact. The reader should be able to skim this in 2-3 minutes and understand enough to follow the paper.

## Output

Save the document to {{outputPath}}. Confirm by writing: DONE: {{topicName}}
