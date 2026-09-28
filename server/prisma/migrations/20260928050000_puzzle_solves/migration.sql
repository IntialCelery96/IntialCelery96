-- AlterTable
ALTER TABLE "Puzzle" ADD COLUMN     "lesson" TEXT NOT NULL DEFAULT '';

-- CreateTable
CREATE TABLE "PuzzleSolve" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "puzzleSlug" TEXT NOT NULL,
    "solvedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PuzzleSolve_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PuzzleSolve_userId_idx" ON "PuzzleSolve"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PuzzleSolve_userId_puzzleSlug_key" ON "PuzzleSolve"("userId", "puzzleSlug");

-- AddForeignKey
ALTER TABLE "PuzzleSolve" ADD CONSTRAINT "PuzzleSolve_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
