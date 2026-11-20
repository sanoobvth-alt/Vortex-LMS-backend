import "dotenv/config";
import { prisma } from "../src/config/prisma.js";
const demoCourse = {
  title: "Sample Course: Web Development Foundations",
  slug: "sample-web-development-foundations",
  description:
    "Clearly labeled sample content for local development. Contains no real student or identity data.",
  durationWeeks: 2,
  status: "PUBLISHED",
};

async function main() {
  const course = await prisma.course.upsert({
    where: { slug: demoCourse.slug },
    create: demoCourse,
    update: demoCourse,
  });
  const weekOne = await prisma.courseWeek.upsert({
    where: { courseId_weekNumber: { courseId: course.id, weekNumber: 1 } },
    create: {
      courseId: course.id,
      weekNumber: 1,
      title: "Sample Week 1: HTML and CSS",
      description: "Sample course week.",
      isPublished: true,
    },
    update: {
      title: "Sample Week 1: HTML and CSS",
      description: "Sample course week.",
      isPublished: true,
    },
  });
  const weekTwo = await prisma.courseWeek.upsert({
    where: { courseId_weekNumber: { courseId: course.id, weekNumber: 2 } },
    create: {
      courseId: course.id,
      weekNumber: 2,
      title: "Sample Week 2: JavaScript Basics",
      description: "Sample course week.",
      isPublished: true,
    },
    update: {
      title: "Sample Week 2: JavaScript Basics",
      description: "Sample course week.",
      isPublished: true,
    },
  });
  const assessmentTitle = "Sample Assessment: Web Foundations";
  let assessment = await prisma.assessment.findFirst({
    where: { weekId: weekTwo.id, title: assessmentTitle },
  });
  const assessmentData = {
    weekId: weekTwo.id,
    title: assessmentTitle,
    description: "Sample multiple-choice assessment.",
    totalMarks: 2,
    passingMarks: 1,
    attemptLimit: 2,
    isPublished: true,
  };
  assessment = assessment
    ? await prisma.assessment.update({
        where: { id: assessment.id },
        data: assessmentData,
      })
    : await prisma.assessment.create({ data: assessmentData });
  const questionOne = await prisma.assessmentQuestion.upsert({
    where: {
      assessmentId_questionOrder: {
        assessmentId: assessment.id,
        questionOrder: 1,
      },
    },
    create: {
      assessmentId: assessment.id,
      questionOrder: 1,
      questionText:
        "Sample question: Which element is commonly used for the main page heading?",
      questionType: "MCQ",
      marks: 1,
    },
    update: {
      questionText:
        "Sample question: Which element is commonly used for the main page heading?",
      questionType: "MCQ",
      marks: 1,
    },
  });
  for (const [optionOrder, optionText, isCorrect] of [
    [1, "<h1>", true],
    [2, "<footer>", false],
    [3, "<aside>", false],
  ]) {
    await prisma.assessmentOption.upsert({
      where: {
        questionId_optionOrder: { questionId: questionOne.id, optionOrder },
      },
      create: {
        questionId: questionOne.id,
        optionOrder,
        optionText,
        isCorrect,
      },
      update: { optionText, isCorrect },
    });
  }
  const questionTwo = await prisma.assessmentQuestion.upsert({
    where: {
      assessmentId_questionOrder: {
        assessmentId: assessment.id,
        questionOrder: 2,
      },
    },
    create: {
      assessmentId: assessment.id,
      questionOrder: 2,
      questionText:
        "Sample question: Which keyword declares a block-scoped variable?",
      questionType: "MCQ",
      marks: 1,
    },
    update: {
      questionText:
        "Sample question: Which keyword declares a block-scoped variable?",
      questionType: "MCQ",
      marks: 1,
    },
  });
  for (const [optionOrder, optionText, isCorrect] of [
    [1, "var", false],
    [2, "let", true],
    [3, "define", false],
  ]) {
    await prisma.assessmentOption.upsert({
      where: {
        questionId_optionOrder: { questionId: questionTwo.id, optionOrder },
      },
      create: {
        questionId: questionTwo.id,
        optionOrder,
        optionText,
        isCorrect,
      },
      update: { optionText, isCorrect },
    });
  }
  console.info(
    "Seeded sample course assessment:",
    course.slug,
    assessment.title,
  );
}

main()
  .catch((error) => {
    console.error("Sample course seed failed:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
