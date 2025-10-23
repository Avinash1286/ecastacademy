import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function POST(request: NextRequest) {
  try {
    const { notes, title } = await request.json();

    if (!notes) {
      return NextResponse.json(
        { error: "Notes are required" },
        { status: 400 }
      );
    }

    if (!process.env.GEMINI_API_KEY) {
      console.warn("GEMINI_API_KEY not set, returning mock quiz");
      // Return mock quiz structure
      return NextResponse.json({
        title: `Quiz: ${title || "Video Quiz"}`,
        questions: [
          {
            id: "1",
            question: "AI-generated quiz will appear here once GEMINI_API_KEY is configured.",
            options: [
              "Configure your GEMINI_API_KEY",
              "Wait for AI to generate questions",
              "Both options are correct",
              "None of the above",
            ],
            correctAnswer: 2,
            explanation: "Once you set up your Gemini API key, AI will automatically generate quiz questions based on the video content.",
          },
        ],
      });
    }

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `You are an expert educational content creator. Given the following notes from a video, create an engaging quiz to test understanding.

Video Title: ${title}

Notes:
${notes}

Create a quiz with 5-10 multiple choice questions in the following JSON format:
{
  "title": "Quiz title",
  "questions": [
    {
      "id": "1",
      "question": "Question text",
      "options": ["Option 1", "Option 2", "Option 3", "Option 4"],
      "correctAnswer": 0,
      "explanation": "Explanation of why this is the correct answer"
    }
  ]
}

Guidelines:
- Create diverse questions covering key concepts
- Make questions clear and unambiguous
- Provide 4 options for each question
- correctAnswer should be the index (0-3) of the correct option
- Include detailed explanations
- Mix difficulty levels (easy, medium, hard)`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // Parse the JSON response
    let quiz;
    try {
      // Try to extract JSON from markdown code blocks if present
      const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/) || text.match(/```\n([\s\S]*?)\n```/);
      const jsonText = jsonMatch ? jsonMatch[1] : text;
      quiz = JSON.parse(jsonText);
    } catch (parseError) {
      console.error("Failed to parse AI response as JSON:", parseError);
      // Fallback structure
      quiz = {
        title: `Quiz: ${title || "Video Quiz"}`,
        questions: [
          {
            id: "1",
            question: "What did you learn from this video?",
            options: [
              "The main concepts",
              "Supporting details",
              "Practical examples",
              "All of the above",
            ],
            correctAnswer: 3,
            explanation: text.substring(0, 200),
          },
        ],
      };
    }

    return NextResponse.json(quiz);
  } catch (error) {
    console.error("[GENERATE_QUIZ_ERROR]", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return NextResponse.json(
      { error: `Failed to generate quiz: ${errorMessage}` },
      { status: 500 }
    );
  }
}
