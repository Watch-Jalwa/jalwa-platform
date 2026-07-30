export type GroundingSource = {
  id: string;
  slug: string;
  title: string;
  description?: string | null;
  category?: string | null;
  language?: string | null;
  attribution?: string | null;
};

export function buildRetrievalQuery(question: string): string;
export function extractResponseText(response: unknown): string;
export function sanitizeSourceCitations(text: string, sourceCount: number): string;
export function buildSourceContext(sources: GroundingSource[]): string;
