export type Severity = "critical" | "high" | "medium" | "low" | "info";

export interface CrawlJobData {
  auditId: string;
  startUrl: string;
  maxPages: number;
}

export interface PageResult {
  url: string;
  finalUrl: string;
  depth: number;
  status: number;
  contentType: string;
  responseMs: number;
  bytes: number;
  title: string | null;
  description: string | null;
  canonical: string | null;
  robots: string | null;
  h1Count: number;
  h2Count: number;
  wordCount: number;
  lang: string | null;
  internalLinks: string[];
  externalLinks: string[];
  keywords: KeywordMetric[];
  issues: Issue[];
}

export interface KeywordMetric {
  keyword: string;
  occurrences: number;
  inTitle: boolean;
  inH1: boolean;
  inHeadings: boolean;
  weightedScore: number;
}

export interface Issue {
  code: string;
  severity: Severity;
  message: string;
  evidence?: Record<string, unknown>;
}
