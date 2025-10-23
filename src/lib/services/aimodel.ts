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

    try {
        // WRAPPED the original API call with the retry utility
        const response = await retryWithExponentialBackoff(() => 
            ai.models.generateContent({
                model,
                config,
                contents,
            })
        );

        return response.text ?? '';
    } catch (error) {
        // Parse and simplify Google AI errors
        if (error && typeof error === 'object' && 'error' in error) {
            const apiError = error.error as { code?: number; message?: string; status?: string };
            
            // Check for quota/rate limit errors
            if (apiError.code === 429 || apiError.status === 'RESOURCE_EXHAUSTED') {
                throw new Error('AI quota exceeded. Please try again in a minute.');
            }
            
            // Check for authentication errors
            if (apiError.code === 401 || apiError.code === 403) {
                throw new Error('AI service authentication failed.');
            }
            
            // Return simplified message if available
            if (apiError.message && apiError.message.length < 100) {
                throw new Error(apiError.message);
            }
        }
        
        // Re-throw with simplified message
        throw new Error('Failed to generate notes. Please try again.');
    }
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

    try {
        // WRAPPED the original API call with the retry utility
        const response = await retryWithExponentialBackoff(() => 
            ai.models.generateContent({
                model,
                config,
                contents,
            })
        );

        return response.text ?? '';
    } catch (error) {
        // Parse and simplify Google AI errors
        if (error && typeof error === 'object' && 'error' in error) {
            const apiError = error.error as { code?: number; message?: string; status?: string };
            
            // Check for quota/rate limit errors
            if (apiError.code === 429 || apiError.status === 'RESOURCE_EXHAUSTED') {
                throw new Error('AI quota exceeded. Please try again in a minute.');
            }
            
            // Check for authentication errors
            if (apiError.code === 401 || apiError.code === 403) {
                throw new Error('AI service authentication failed.');
            }
            
            // Return simplified message if available
            if (apiError.message && apiError.message.length < 100) {
                throw new Error(apiError.message);
            }
        }
        
        // Re-throw with simplified message
        throw new Error('Failed to generate quiz. Please try again.');
    }
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