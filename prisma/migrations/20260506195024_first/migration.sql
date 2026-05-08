-- CreateEnum
CREATE TYPE "TranscriptionStatus" AS ENUM ('processing', 'done', 'failed');

-- CreateTable
CREATE TABLE "Transcription" (
    "id" TEXT NOT NULL,
    "status" "TranscriptionStatus" NOT NULL DEFAULT 'processing',
    "language" TEXT,
    "provider" TEXT NOT NULL,
    "textRaw" TEXT,
    "text" TEXT,
    "providerMeta" JSONB,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "errorRetryable" BOOLEAN,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Transcription_pkey" PRIMARY KEY ("id")
);
