import {
  SessionStage,
  StudyPlan,
  StudyPlanProvisioningStatus,
  StudyPlanTopic,
  StudySession,
  TopicResearch,
} from '../domain/models';

export function mapProvisioningStatus(status: StudyPlanProvisioningStatus): string {
  const map: Record<StudyPlanProvisioningStatus, string> = {
    CREATING: 'Creating',
    GENERATING: 'Generating',
    READY: 'Ready',
    FAILED: 'Failed',
  };
  return map[status];
}

export function mapTopicStatus(status: StudyPlanTopic['status']): string {
  const map: Record<StudyPlanTopic['status'], string> = {
    PLANNED: 'Planned',
    GENERATING: 'Generating',
    READY: 'Ready',
    COMPLETED: 'Done',
    FAILED: 'Failed',
    SKIPPED: 'Done',
  };
  return map[status] ?? 'Planned';
}

export function mapSessionStage(stage: SessionStage): string {
  if (stage === 'FAILED') return 'Failed';
  if (stage === 'COMPLETED' || stage === 'UPLOADED') return 'Done';
  if (
    stage === 'CONTENT_PENDING' ||
    stage === 'CONTENT_READY' ||
    stage === 'CONVERSATION_PLAN_PENDING' ||
    stage === 'CONVERSATION_PLAN_READY'
  ) {
    return 'Research';
  }
  if (stage === 'SCRIPT_PENDING' || stage === 'SCRIPT_READY') return 'Script';
  if (stage === 'DIALOGUE_POLISH_PENDING' || stage === 'DIALOGUE_READY') return 'Script';
  if (stage === 'AUDIO_PENDING' || stage === 'AUDIO_GENERATING' || stage === 'AUDIO_READY') {
    return 'Audio';
  }
  if (stage === 'UPLOAD_PENDING') return 'Upload';
  return 'Generating';
}

export function sessionReadableBlocks(
  session: StudySession,
  dashboardUrl: string,
): string[] {
  const lines: string[] = [];
  if (session.research) {
    lines.push('Research summary', ...researchLines(session.research), '');
  }
  if (session.script?.turns.length) {
    lines.push(
      'Podcast Script',
      session.script.turns
        .map(
          (turn) =>
            `${turn.speaker[0] + turn.speaker.slice(1).toLowerCase()}:\n${turn.text}`,
        )
        .join('\n\n'),
      '',
    );
  }
  if (session.audioUrl) {
    lines.push(`Audio: ${session.audioUrl}`, '');
  }
  lines.push(`Open in dashboard → ${dashboardUrl}`);
  return lines.filter((line) => line !== undefined);
}

function researchLines(research: TopicResearch): string[] {
  const lines = [research.summary];
  if (research.keyConcepts.length) {
    lines.push('', 'Key concepts:', ...research.keyConcepts.map((c) => `• ${c}`));
  }
  if (research.sources.length) {
    lines.push('', 'Sources:', ...research.sources.slice(0, 5).map((s) => `• ${s.title}: ${s.url}`));
  }
  return lines;
}
