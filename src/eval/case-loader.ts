import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { EvalCase } from './eval-case.types';

export function loadEvalCases(casesDir = join(process.cwd(), 'evaluation', 'cases')): EvalCase[] {
  return readdirSync(casesDir)
    .filter((name) => name.endsWith('.json'))
    .sort()
    .map((name) => JSON.parse(readFileSync(join(casesDir, name), 'utf8')) as EvalCase)
    .filter((item) => !item.disabled);
}

export function loadEvalCase(caseId: string): EvalCase {
  const cases = loadEvalCases();
  const found = cases.find((item) => item.id === caseId);
  if (!found) throw new Error(`Eval case not found: ${caseId}`);
  return found;
}

export function filterCases(cases: EvalCase[], caseFilter?: string): EvalCase[] {
  if (!caseFilter) return cases;
  return cases.filter((item) => item.id === caseFilter || item.id.includes(caseFilter));
}
