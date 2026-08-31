-- CreateTable
CREATE TABLE "StudyPlan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "goal" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "durationWeeks" INTEGER NOT NULL,
    "sessionsPerWeek" INTEGER NOT NULL,
    "preferredDays" TEXT NOT NULL,
    "startDate" TEXT NOT NULL,
    "endDate" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "provisioningStatus" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "provisioningError" TEXT,
    "overview" TEXT NOT NULL DEFAULT '',
    "notionPageId" TEXT,
    "notionUrl" TEXT,
    "targetSessionMinutes" INTEGER NOT NULL,
    "currentTopicId" TEXT,
    "createdAt" DATETIME NOT NULL,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "StudyPlanTopic" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studyPlanId" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "studied" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL,
    "scheduledAt" TEXT NOT NULL,
    "week" INTEGER NOT NULL,
    "sequence" INTEGER NOT NULL,
    "notionPageId" TEXT,
    CONSTRAINT "StudyPlanTopic_studyPlanId_fkey" FOREIGN KEY ("studyPlanId") REFERENCES "StudyPlan" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StudySession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studyPlanId" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "generationKey" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL,
    "completedAt" DATETIME,
    "notionPageId" TEXT,
    CONSTRAINT "StudySession_studyPlanId_fkey" FOREIGN KEY ("studyPlanId") REFERENCES "StudyPlan" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "StudyPlan_idempotencyKey_key" ON "StudyPlan"("idempotencyKey");

-- CreateIndex
CREATE INDEX "StudyPlan_status_idx" ON "StudyPlan"("status");

-- CreateIndex
CREATE INDEX "StudyPlanTopic_studyPlanId_status_idx" ON "StudyPlanTopic"("studyPlanId", "status");

-- CreateIndex
CREATE INDEX "StudyPlanTopic_studyPlanId_order_idx" ON "StudyPlanTopic"("studyPlanId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "StudySession_generationKey_key" ON "StudySession"("generationKey");

-- CreateIndex
CREATE INDEX "StudySession_studyPlanId_idx" ON "StudySession"("studyPlanId");
