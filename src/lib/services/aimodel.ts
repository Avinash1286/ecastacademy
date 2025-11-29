"use server";

import {
	generateNotes as sharedGenerateNotes,
	generateQuiz as sharedGenerateQuiz,
	repairStructuredJson as sharedRepairStructuredJson,
	generateTutorResponse as sharedGenerateTutorResponse,
} from "@shared/ai/generation";
import type { StructuredRepairRequest, TutorChatMessage } from "@shared/ai/generation";

export async function generateNotes(
	rawTranscript: Parameters<typeof sharedGenerateNotes>[0],
	options: Parameters<typeof sharedGenerateNotes>[1]
) {
	return sharedGenerateNotes(rawTranscript, options);
}

export async function generateQuiz(
	input: Parameters<typeof sharedGenerateQuiz>[0],
	modelConfig: Parameters<typeof sharedGenerateQuiz>[1]
) {
	return sharedGenerateQuiz(input, modelConfig);
}

export async function repairStructuredJson(
	payload: StructuredRepairRequest,
	modelConfig: Parameters<typeof sharedRepairStructuredJson>[1]
) {
	return sharedRepairStructuredJson(payload, modelConfig);
}

export async function generateTutorResponse(
	params: Parameters<typeof sharedGenerateTutorResponse>[0]
) {
	return sharedGenerateTutorResponse(params);
}

export type { StructuredRepairRequest, TutorChatMessage };