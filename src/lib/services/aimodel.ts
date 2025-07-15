"use server";
import { GoogleGenAI } from '@google/genai';
import { NOTES_PROMPT, QUIZ_PROMPT, VALID_JSON_PROMPT } from '@/lib/prompts';
import { retryWithExponentialBackoff } from '../utils'; 


const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
});

const model = 'gemini-2.5-pro';

export const generateNotes = async (input: string): Promise<string> => {
    const config = {
        thinkingConfig: {
            thinkingBudget: -1,
        },
        responseMimeType: 'application/json',
        generationConfig: {
            maxOutputTokens: 65536,
        },
        systemInstruction: [
            {
                text: NOTES_PROMPT,
            }
        ],
    };

    const contents = [
        {
            role: 'user',
            parts: [
                {
                    text: input,
                },
            ],
        },
    ];

    // WRAPPED the original API call with the retry utility
    const response = await retryWithExponentialBackoff(() => 
        ai.models.generateContent({
            model,
            config,
            contents,
        })
    );

    return response.text ?? '';
}

export const generateQuiz = async (input: string): Promise<string> => {
    const config = {
        thinkingConfig: {
            thinkingBudget: -1,
        },
        responseMimeType: 'application/json',
        generationConfig: {
            maxOutputTokens: 65536,
        },
        systemInstruction: [
            {
                text: QUIZ_PROMPT,
            }
        ],
    };
    const contents = [
        {
            role: 'user',
            parts: [
                {
                    text: input,
                },
            ],
        },
    ];

    // WRAPPED the original API call with the retry utility
    const response = await retryWithExponentialBackoff(() => 
        ai.models.generateContent({
            model,
            config,
            contents,
        })
    );

    return response.text ?? '';
}


export const generateValidJson = async (input: string): Promise<string> => {
    const config = {
        thinkingConfig: {
            thinkingBudget: -1,
        },
        responseMimeType: 'application/json',
        generationConfig: {
            maxOutputTokens: 65536,
        },
        systemInstruction: [
            {
                text: VALID_JSON_PROMPT,
            }
        ],
    };
    const contents = [
        {
            role: 'user',
            parts: [
                {
                    text: input,
                },
            ],
        },
    ];

    // WRAPPED the original API call with the retry utility
    const response = await retryWithExponentialBackoff(() => 
        ai.models.generateContent({
            model,
            config,
            contents,
        })
    );

    return response.text ?? '';
}