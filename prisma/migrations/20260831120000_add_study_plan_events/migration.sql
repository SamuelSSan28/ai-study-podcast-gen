CREATE TABLE "StudyPlanEvent" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "planId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "severity" TEXT NOT NULL,
  "topicId" TEXT,
  "sessionId" TEXT,
  "stage" TEXT,
  "result" TEXT,
  "error" TEXT,
  "metadata" TEXT,
  "createdAt" DATETIME NOT NULL,
  CONSTRAINT "StudyPlanEvent_planId_fkey" FOREIGN KEY ("planId") REFERENCES "StudyPlan" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "StudyPlanEvent_planId_createdAt_idx" ON "StudyPlanEvent"("planId", "createdAt");
CREATE INDEX "StudyPlanEvent_planId_severity_idx" ON "StudyPlanEvent"("planId", "severity");
