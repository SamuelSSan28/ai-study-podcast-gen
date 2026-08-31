export class SessionGenerationSkippedError extends Error {
  readonly code = 'WAITING_FOR_PREREQUISITES' as const;

  constructor(
    public readonly planId: string,
    public readonly waitingTopicCount: number,
  ) {
    super(
      `Session generation skipped: no completed prerequisite topics (${waitingTopicCount} roadmap topics waiting)`,
    );
    this.name = 'SessionGenerationSkippedError';
  }
}

export function isSessionGenerationSkippedError(
  error: unknown,
): error is SessionGenerationSkippedError {
  return error instanceof SessionGenerationSkippedError;
}
