/**
 * BM25 (Best Matching 25) Search Algorithm
 *
 * Industry-standard probabilistic ranking function used by major search engines.
 *
 * BM25 considers:
 * - Term frequency (TF): How often terms appear in a document
 * - Inverse document frequency (IDF): How rare/common terms are across all documents
 * - Document length normalization: Prevents bias toward longer documents
 * - Field boosting: Different weights for title, description, etc.
 *
 * Parameters:
 * - k1 (default: 1.5): Controls term frequency saturation
 * - b (default: 0.75): Controls document length normalization
 */

interface BM25Document {
  id: string;
  fields: Record<string, string>;
}

interface BM25Config {
  k1?: number; // Term frequency saturation parameter (1.2-2.0 recommended)
  b?: number; // Length normalization parameter (0-1, 0.75 recommended)
  fieldWeights?: Record<string, number>; // Boost factors for different fields
}

export class BM25 {
  private k1: number;
  private b: number;
  private fieldWeights: Record<string, number>;

  // Cached values for performance
  private documents: BM25Document[] = [];
  private avgDocLength: Record<string, number> = {};
  private idfCache: Map<string, number> = new Map();
  private tokenizedDocs: Map<string, Record<string, string[]>> = new Map();

  constructor(config: BM25Config = {}) {
    this.k1 = config.k1 ?? 1.5;
    this.b = config.b ?? 0.75;
    this.fieldWeights = config.fieldWeights ?? {
      title: 2.0, // Title matches are 2x more important
      description: 1.0, // Description matches have normal weight
      content: 0.8, // Content matches are slightly less important
      url: 0.5, // URL matches are least important
    };
  }

  /**
   * Tokenize text into terms
   * - Lowercase
   * - Remove special characters
   * - Split on whitespace
   * - Filter out very short terms
   */
  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, " ")
      .split(/\s+/)
      .filter((term) => term.length >= 2);
  }

  /**
   * Index documents for searching
   */
  public indexDocuments(documents: BM25Document[]): void {
    this.documents = documents;
    this.tokenizedDocs.clear();
    this.idfCache.clear();

    // Tokenize all documents and calculate average document length per field
    const fieldLengths: Record<string, number[]> = {};

    for (const doc of documents) {
      const tokenized: Record<string, string[]> = {};

      for (const [field, value] of Object.entries(doc.fields)) {
        const tokens = this.tokenize(value || "");
        tokenized[field] = tokens;

        if (!fieldLengths[field]) {
          fieldLengths[field] = [];
        }
        fieldLengths[field].push(tokens.length);
      }

      this.tokenizedDocs.set(doc.id, tokenized);
    }

    // Calculate average document length for each field
    for (const [field, lengths] of Object.entries(fieldLengths)) {
      const sum = lengths.reduce((a, b) => a + b, 0);
      this.avgDocLength[field] = lengths.length > 0 ? sum / lengths.length : 0;
    }

    // Pre-calculate IDF for all terms
    this.calculateIDF();
  }

  /**
   * Calculate Inverse Document Frequency (IDF) for all terms
   * IDF measures how rare/common a term is across all documents
   */
  private calculateIDF(): void {
    const termDocFreq = new Map<string, number>();
    const N = this.documents.length;

    // Count how many documents contain each term
    for (const tokenized of this.tokenizedDocs.values()) {
      const seenTerms = new Set<string>();

      for (const tokens of Object.values(tokenized)) {
        for (const term of tokens) {
          if (!seenTerms.has(term)) {
            seenTerms.add(term);
            termDocFreq.set(term, (termDocFreq.get(term) || 0) + 1);
          }
        }
      }
    }

    // Calculate IDF for each term
    // IDF = log((N - df + 0.5) / (df + 0.5) + 1)
    for (const [term, df] of termDocFreq.entries()) {
      const idf = Math.log((N - df + 0.5) / (df + 0.5) + 1);
      this.idfCache.set(term, idf);
    }
  }

  /**
   * Get IDF for a term
   */
  private getIDF(term: string): number {
    return this.idfCache.get(term) || 0;
  }

  /**
   * Calculate BM25 score for a single field
   * BM25 = IDF * (tf * (k1 + 1)) / (tf + k1 * (1 - b + b * (docLength / avgDocLength)))
   */
  private calculateFieldScore(
    queryTerms: string[],
    docTokens: string[],
    avgLength: number
  ): number {
    let score = 0;
    const docLength = docTokens.length;

    for (const term of queryTerms) {
      // Term frequency in document
      const tf = docTokens.filter((t) => t === term).length;

      if (tf === 0) continue;

      // Get IDF
      const idf = this.getIDF(term);

      // Calculate BM25 score for this term
      const numerator = tf * (this.k1 + 1);
      const denominator = tf + this.k1 * (1 - this.b + this.b * (docLength / (avgLength || 1)));

      score += idf * (numerator / denominator);
    }

    return score;
  }

  /**
   * Search documents using BM25 algorithm
   * Returns documents sorted by relevance score
   */
  public search(
    query: string,
    maxResults: number = 10
  ): Array<{ id: string; score: number; doc: BM25Document }> {
    const queryTerms = this.tokenize(query);

    if (queryTerms.length === 0) {
      return [];
    }

    const scores: Array<{ id: string; score: number; doc: BM25Document }> = [];

    // Calculate BM25 score for each document
    for (const doc of this.documents) {
      const tokenized = this.tokenizedDocs.get(doc.id);
      if (!tokenized) continue;

      let totalScore = 0;

      // Calculate score for each field and apply field weights
      for (const [field, tokens] of Object.entries(tokenized)) {
        const fieldScore = this.calculateFieldScore(
          queryTerms,
          tokens,
          this.avgDocLength[field] || 1
        );

        const weight = this.fieldWeights[field] || 1.0;
        totalScore += fieldScore * weight;
      }

      if (totalScore > 0) {
        scores.push({ id: doc.id, score: totalScore, doc });
      }
    }

    // Sort by score (descending) and return top results
    return scores.sort((a, b) => b.score - a.score).slice(0, maxResults);
  }
}
