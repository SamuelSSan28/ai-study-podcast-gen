export interface EvalCaseTopic {
  title: string;
  description: string;
  summary: string;
  week: number;
  sequence: number;
  difficulty: 'FOUNDATIONAL' | 'INTERMEDIATE' | 'ADVANCED';
  tags: string[];
  learningObjectives: string[];
  prerequisites: string[];
  depthDelta: string;
  level: 'FOUNDATION' | 'CORE' | 'INTERMEDIATE' | 'ADVANCED' | 'APPLIED';
  estimatedMinutes: number;
}

export interface EvalCase {
  id: string;
  source?: string;
  disabled?: boolean;
  title: string;
  goal: string;
  topic: EvalCaseTopic;
  expectedObjectives: string[];
  difficulty?: 'standard' | 'hard';
}
