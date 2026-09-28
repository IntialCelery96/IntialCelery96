-- AlterTable
ALTER TABLE "Lesson" ADD COLUMN     "course" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "Puzzle" ADD COLUMN     "prompt" TEXT NOT NULL DEFAULT 'Find the winning move.',
ADD COLUMN     "rating" INTEGER NOT NULL DEFAULT 1200,
ADD COLUMN     "theme" TEXT NOT NULL DEFAULT 'winInOne';

-- DropIndex
DROP INDEX "Lesson_difficulty_order_idx";

-- CreateIndex
CREATE INDEX "Lesson_difficulty_course_order_idx" ON "Lesson"("difficulty", "course", "order");
