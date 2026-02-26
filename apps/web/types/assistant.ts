export type AssistantTrigger = {
  rule: string;
  algorithm: string;
  metric?: string;
  threshold?: number;
  score?: number;
  details?: Record<string, number | string | boolean>;
};

export type AssistantRecommendation = {
  id: string;
  title: string;
  checklist: string[];
  evidence: Array<{
    type: string;
    id: string;
    timestamps: string[];
  }>;
  triggeredBy: AssistantTrigger[];
};

export type AssistantEvent = {
  id: string;
  type: string;
  start: string;
  end: string;
  changePointAt: string | null;
  score: number;
  variablesChanged: Array<{
    metric: string;
    delta: number;
    score: number;
  }>;
  triggeredBy: AssistantTrigger[];
};

export type AssistantAnomaly = {
  id: string;
  start: string;
  end: string;
  score: number;
  drivers: Array<{
    metric: string;
    meanAbsZ?: number;
    maxAbsZ?: number;
  }>;
  triggeredBy: AssistantTrigger[];
};

export type AssistantCorrelation = {
  id: string;
  pair: string;
  lagMinutes: number;
  strength: number;
  samples: number;
  relationship: string;
  triggeredBy: AssistantTrigger[];
};

export type AssistantAnalyzeResponse = {
  summary: string;
  confidence: number;
  events: AssistantEvent[];
  anomalies: AssistantAnomaly[];
  correlations: AssistantCorrelation[];
  recommendations: AssistantRecommendation[];
  dataQuality?: {
    confidencePerSeries?: Array<{ metric: string; confidence: number }>;
    issues?: Array<{ id: string; metric: string; start: string; end: string; type: string; score: number }>;
  };
  meta?: {
    generatedAt?: string;
    elapsedMs?: number;
    timezone?: string;
  };
};
