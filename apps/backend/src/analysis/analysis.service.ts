import { Injectable } from "@nestjs/common";
import Groq from "groq-sdk";
import { UIElement, ClippedElement } from "../crawler/crawler.service";

export interface Issue {
  type: string;
  severity: "low" | "medium" | "high";
  description: string;
  suggestion?: string;
  target?: { text?: string; tag?: string };
  location?: { x: number; y: number; width: number; height: number };
}

interface PageData {
  layout: {
    hasHorizontalScroll: boolean;
    viewport: { width: number; height: number };
    document: { scrollWidth: number; scrollHeight: number };
  };
  uiElements: UIElement[];
  clippedElements: ClippedElement[];
}

@Injectable()
export class AnalysisService {
  async analyzePage(page: PageData): Promise<Issue[]> {
    return [
      ...this.detectLayoutOverflow(page.layout),
      ...this.detectClipping(page.clippedElements),
      ...(await this.detectTextIssues(page.uiElements)),
    ];
  }

  private detectLayoutOverflow(layout: PageData["layout"]): Issue[] {
    if (!layout.hasHorizontalScroll) return [];
    return [
      {
        type: "layout_overflow",
        severity: "high",
        description:
          "Horizontal scroll detected — content exceeds viewport width",
        suggestion:
          "Check CSS width, flex/grid usage, or large elements causing overflow",
      },
    ];
  }

  private readonly LOW_VALUE_WORDS = [
    "home", "about", "contact", "login", "signup",
    "register", "menu", "search", "cart",
    "accept", "reject", "cookie", "privacy",
    "terms", "skip", "next", "previous",
  ];

  filterMeaningfulElements(elements: UIElement[]): UIElement[] {
    const seen = new Set<string>();

    return elements
      .map((el) => ({ ...el, text: el.text.trim() }))
      .filter((el) => {
        const { text } = el;

        // Length bounds: must be 8–100 chars
        if (!text || text.length < 8 || text.length > 100) return false;

        // Nav/generic words
        const lower = text.toLowerCase();
        if (this.LOW_VALUE_WORDS.some((word) => lower.includes(word))) return false;

        // Repeated pattern (e.g. "Behavioral HealthBehavioral Health")
        const half = text.slice(0, Math.floor(text.length / 2));
        if (half.length >= 8 && text.toLowerCase().indexOf(half.toLowerCase(), 1) !== -1) return false;

        // Truncated / incomplete text: multi-word phrase ending on a 1–2 char stub with no punctuation
        const hasPunctuation = /[.!?:,;)\]"']$/.test(text);
        const words = text.split(/\s+/);
        const lastWord = words[words.length - 1];
        const endsAbruptly = !hasPunctuation && words.length > 1 && lastWord.length <= 2;
        if (endsAbruptly) return false;

        // Deduplicate
        if (seen.has(text)) return false;
        seen.add(text);

        return true;
      })
      .sort((a, b) => b.text.length - a.text.length);
  }

  private detectClipping(clippedElements: ClippedElement[]): Issue[] {
    if (clippedElements.length === 0) return [];

    if (clippedElements.length === 1) {
      const el = clippedElements[0];
      return [{
        type: "element_clipping",
        severity: "medium",
        description: "Element exceeds its bounds and may be visually clipped",
        suggestion: "Check overflow, fixed heights, or positioning issues",
        target: { tag: el.tag },
        location: { x: el.x, y: el.y, width: el.width, height: el.height },
      }];
    }

    const first = clippedElements[0];
    return [{
      type: "element_clipping",
      severity: "medium",
      description: `${clippedElements.length} elements may be clipped or exceed viewport bounds`,
      suggestion: "Check overflow, fixed heights, or positioning issues",
      location: { x: first.x, y: first.y, width: first.width, height: first.height },
    }];
  }

  private async detectTextIssues(uiElements: UIElement[]): Promise<Issue[]> {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      console.warn("GROQ_API_KEY not set — skipping text analysis");
      return [];
    }

    const groq = new Groq({ apiKey });

    const filtered = this.filterMeaningfulElements(uiElements);
    const payload = filtered
      .slice(0, 30)
      .map((el) => ({ id: el.id, text: el.text.slice(0, 150) }));

    console.log(`\n--- Text Analysis Debug ---`);
    console.log(`Total elements: ${uiElements.length}`);
    console.log(`Filtered elements: ${filtered.length}`);
    console.log(`Sample payload (first 5):`, JSON.stringify(payload.slice(0, 5), null, 2));
    console.log(`---------------------------\n`);

    if (payload.length === 0) {
      console.log("No meaningful elements after filtering — skipping LLM call");
      return [];
    }

    const prompt = `You are a strict UI QA checker.

Your job is ONLY to detect spelling mistakes (typos).

STRICT RULES:
- DO NOT rewrite or improve text
- DO NOT complete sentences
- DO NOT suggest better wording
- ONLY report clear spelling mistakes
- If text is incomplete or ambiguous, IGNORE it
- If no typos exist, return []

Return ONLY valid JSON:
[{"id":number,"issue":"typo","text":string,"suggestion":string,"severity":"low"}]

Elements: ${JSON.stringify(payload)}`;

    console.log('\n--- Groq Request ---');
    console.log(prompt);
    console.log('--------------------\n');

    let raw: string;
    try {
      const completion = await groq.chat.completions.create({
        model: "llama-3.1-8b-instant",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.1,
      });
      const content = completion.choices[0].message.content ?? "";
      console.log('\n--- Groq Response ---');
      console.log(content);
      console.log('---------------------\n');
      const match = content.match(/\[[\s\S]*\]/);
      raw = match ? match[0] : "[]";
    } catch (err) {
      console.warn("Groq API call failed:", err.message);
      return [];
    }

    let aiResults: Array<{
      id: number;
      issue: string;
      text: string;
      suggestion: string;
      severity: string;
    }> = [];

    try {
      aiResults = JSON.parse(raw);
    } catch {
      console.warn("Failed to parse Groq response:", raw);
      return [];
    }

    return aiResults.map((r) => {
      const el = uiElements.find((e) => e.id === r.id);
      return {
        type: "typo",
        severity: "low" as const,
        description: `"${r.text}" — typo`,
        suggestion: r.suggestion,
        target: el ? { text: el.text, tag: el.tag } : undefined,
        location: el
          ? { x: el.x, y: el.y, width: el.width, height: el.height }
          : undefined,
      };
    });
  }
}
