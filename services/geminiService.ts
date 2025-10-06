import { GoogleGenAI, GenerateContentResponse, GenerateContentParameters, GenerateImagesResponse } from "@google/genai";
import { 
    NewsArticleCore, GroundingSource, ContentType, 
    SelectedLanguageCode, ContentCategoryValue, getLanguageName, 
    SelectedCountryCode, AiProcessedPrompt, SelectedEmotion, Emotions, 
    LanguageOptions, ViralRecreationContent,
    // ApiKey // ApiKey is no longer needed as per guidelines
} from '../types.ts';

// Creates a Gemini client instance.
const getAiClient = (): GoogleGenAI => {
    // Per coding guidelines, API key must come only from process.env.API_KEY.
    if (!process.env.API_KEY) {
        throw new Error("API Key is not configured. Please set the process.env.API_KEY variable.");
    }
    return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

const TEXT_MODEL_NAME = 'gemini-2.5-flash';
const IMAGE_MODEL_NAME = 'imagen-4.0-generate-001';

// --- NEW CENTRALIZED ERROR HANDLER ---
/**
 * Parses and standardizes API errors into user-friendly messages.
 * @param error The raw error object from a catch block.
 * @param context A string describing where the error occurred (e.g., 'generateAiArticleImage').
 * @returns A standard Error object with a clean message.
 */
function handleApiError(error: any, context: string): Error {
    console.error(`Error in ${context}:`, error);

    let rawMessage = '';

    if (error instanceof Error) {
        rawMessage = error.message;
    } else if (typeof error === 'object' && error !== null && 'message' in error) {
        rawMessage = String((error as { message: string }).message);
    } else if (typeof error === 'string') {
        rawMessage = error;
    }

    if (rawMessage.includes("API key not valid") || rawMessage.includes("API_KEY_INVALID")) {
        return new Error("An invalid Google API Key was provided. Please check your API_KEY environment variable.");
    }
    
    if (rawMessage.includes("permission") || rawMessage.includes("denied")) {
        return new Error(`Gemini API permission denied. Details: ${rawMessage}`);
    }

    // Try to parse JSON error from the message, which is common for Gemini API errors
    try {
        const jsonMatch = rawMessage.match(/\{.*\}/s);
        const jsonString = jsonMatch ? jsonMatch[0] : rawMessage;
        const errorJson = JSON.parse(jsonString);

        if (errorJson.error) {
            const { code, status, message: apiMessage } = errorJson.error;
            if (code === 429 || status === "RESOURCE_EXHAUSTED") {
                return new Error("API rate limit exceeded. Please wait a minute and try again.");
            }
            // Sanitize the API message to be more user-friendly
            let cleanApiMessage = apiMessage.split('For more information on this error')[0].trim();
            cleanApiMessage = cleanApiMessage.replace(/\n\* Quota exceeded for metric:[\s\S]*/, '');
            return new Error(`API Error: ${cleanApiMessage}`);
        }
    } catch (e) {
        // Not a JSON error, or parsing failed. Use the raw message if it's not too long.
        if (rawMessage) {
            return new Error(rawMessage.substring(0, 250));
        }
    }
    
    return new Error(`An unexpected error occurred in ${context}.`);
}


export function parseJsonFromMarkdown(markdownString: string): any {
  let jsonString = markdownString.trim();

  // 1. Try to extract from a markdown code fence first. This is the most reliable.
  // The regex now looks for a fence anywhere in the string.
  const fenceRegex = /```(?:json)?\s*([\s\S]*?)\s*```/s;
  const match = jsonString.match(fenceRegex);

  if (match && match[1]) {
    // If we find a fenced block, we assume it's the entire JSON content.
    jsonString = match[1].trim();
  } else {
    // 2. If no fence, find the first '{' or '[' and the last '}' or ']'
    const firstBracket = jsonString.indexOf('[');
    const firstBrace = jsonString.indexOf('{');
    
    let startIndex = -1;
    
    // Find the first occurrence of either '[' or '{'
    if (firstBracket !== -1 && firstBrace !== -1) {
        startIndex = Math.min(firstBracket, firstBrace);
    } else if (firstBracket !== -1) {
        startIndex = firstBracket;
    } else {
        startIndex = firstBrace; // This will be -1 if neither is found
    }

    if (startIndex !== -1) {
        const lastBracket = jsonString.lastIndexOf(']');
        const lastBrace = jsonString.lastIndexOf('}');
        const endIndex = Math.max(lastBracket, lastBrace);
        
        if (endIndex > startIndex) {
            jsonString = jsonString.substring(startIndex, endIndex + 1);
        }
    }
  }
  
  // 3. Try to parse the cleaned string.
  try {
    return JSON.parse(jsonString);
  } catch (error) {
    console.error("Failed to parse JSON string after cleaning:", jsonString, error);
    throw new Error(`Failed to parse content as JSON. Raw: ${markdownString.substring(0, 150)}`);
  }
}

export async function fetchContentFromPrompt(
  prompt: string,
  count: number,
  languageCode: SelectedLanguageCode,
  countryCode: SelectedCountryCode,
  countryName: string,
  emotion: SelectedEmotion
): Promise<{ articles: NewsArticleCore[], sourcesByHeadline: Record<string, GroundingSource[]> }> {
    const languageName = getLanguageName(languageCode);
    const emotionName = Emotions[emotion].split(' ')[1] || 'Neutral';

    const fullPrompt = `
User has requested content based on the following prompt: "${prompt}".
Please generate ${count} unique items. The content should be relevant for ${countryName} and in the ${languageName} language.

STYLE GUIDELINES:
- The overall tone should be influenced by the emotion of: "${emotionName}".
- Generate headlines that are sensational, bold, and highly engaging, like popular social media news feeds.
- Headlines should be attention-grabbing, sometimes shocking, controversial, or expressing a strong opinion related to the emotion.
- Summaries should be short (1-2 sentences), clear, and expand on the headline.

Each item must have a "long_headline" and a "summary".
Prioritize recent and verifiable information if possible, using your knowledge and search capabilities.

Return a single, valid JSON array of objects, like this example:
[
  {"long_headline": "Example Headline 1", "summary": "This is an example summary for the first item."},
  {"long_headline": "Example Headline 2", "summary": "Another example summary for the second item."}
]

Ensure headlines are distinct and summaries are informative.
`;

    const requestParams: GenerateContentParameters = {
        model: TEXT_MODEL_NAME,
        contents: fullPrompt,
        config: {
          temperature: 0.8,
          tools: [{googleSearch: {}}],
        }
    };
    
    return await executeContentFetch(requestParams);
}


export async function fetchContent(
  count: number,
  contentType: ContentType,
  category: ContentCategoryValue,
  languageCode: SelectedLanguageCode,
  countryCode: SelectedCountryCode, 
  countryName: string,
  emotion: SelectedEmotion
): Promise<{ articles: NewsArticleCore[], sourcesByHeadline: Record<string, GroundingSource[]> }> {
  const languageName = getLanguageName(languageCode);
  const emotionName = Emotions[emotion].split(' ')[1] || 'Neutral';
  const itemType = contentType === ContentType.News ? "news articles" : "interesting facts";
  
  const prompt = `
Generate ${count} unique ${itemType} about "${category}" relevant to ${countryName} (especially if not "Worldwide").
The content should be in ${languageName}.

STYLE GUIDELINES:
- The overall tone MUST be influenced by the emotion of: "${emotionName}". For example, if the emotion is 'Anger', the tone should be passionate and critical. If 'Awe', it should be wondrous and inspiring.
- Generate headlines that are sensational, bold, and highly engaging, like popular social media news feeds.
- Headlines MUST be attention-grabbing, sometimes shocking, controversial, or expressing a strong opinion related to the emotion.
- Summaries MUST be short (1-2 sentences), clear, and expand on the headline.

Each item must have a "long_headline" (the sensational headline) and a "summary".

Return a single, valid JSON array of objects, like this example:
[
  {"long_headline": "Example Headline 1", "summary": "This is an example summary for the first item."},
  {"long_headline": "Example Headline 2", "summary": "Another example summary for the second item."}
]

Ensure headlines are distinct and summaries are informative.
Focus on accuracy for the specified language and region, while adhering to the emotional tone and sensational style.
For news, prioritize recent and verifiable information if possible.
`;

  const requestParams: GenerateContentParameters = {
    model: TEXT_MODEL_NAME,
    contents: prompt,
    config: {
      temperature: 0.8, 
    }
  };

  if (contentType === ContentType.News) {
    if (!requestParams.config) requestParams.config = {};
    requestParams.config.tools = [{googleSearch: {}}];
  } else {
    if (!requestParams.config) requestParams.config = {};
    requestParams.config.responseMimeType = "application/json";
  }
  
  return await executeContentFetch(requestParams);
}

// Helper to process response and grounding data, to avoid code duplication
function processApiResponse(rawText: string, groundingMetadata: any): { articles: NewsArticleCore[], sourcesByHeadline: Record<string, GroundingSource[]> } {
    const parsedData = parseJsonFromMarkdown(rawText);

    if (!Array.isArray(parsedData) || (parsedData.length > 0 && !(parsedData[0].long_headline && parsedData[0].summary))) {
        console.error("Parsed data is not in the expected format:", parsedData);
        throw new Error("AI response was not a valid array of articles/facts.");
    }
    const articles: NewsArticleCore[] = parsedData;

    const sourcesByHeadline: Record<string, GroundingSource[]> = {};
    if (groundingMetadata?.groundingChunks) {
        articles.forEach(article => {
            const rawChunks = groundingMetadata.groundingChunks;
            if (rawChunks) {
                sourcesByHeadline[article.long_headline] = rawChunks
                    .filter((chunk: any) => chunk.web && typeof chunk.web.uri === 'string' && typeof chunk.web.title === 'string')
                    .map((chunk: any) => ({ web: { uri: chunk.web!.uri!, title: chunk.web!.title! } }));
            } else {
                sourcesByHeadline[article.long_headline] = [];
            }
        });
    }
    
    return { articles, sourcesByHeadline };
}


async function executeContentFetch(
    baseRequestParams: GenerateContentParameters
): Promise<{ articles: NewsArticleCore[], sourcesByHeadline: Record<string, GroundingSource[]> }> {
    try {
        const client = getAiClient();
        const response = await client.models.generateContent(baseRequestParams);
        const groundingMetadata = response.candidates?.[0]?.groundingMetadata;
        return processApiResponse(response.text, groundingMetadata);
    } catch (error) {
        throw handleApiError(error, 'executeContentFetch');
    }
}


export async function getHighlightedHeadlineHtml(
  originalHeadline: string, 
  languageCode: SelectedLanguageCode,
  highlightColors: string[]
): Promise<string> {
  const client = getAiClient();
  const languageName = getLanguageName(languageCode);
  
  const colorsToSuggest = highlightColors.length > 0 ? highlightColors.join(', ') : "'#E74C3C', '#3498DB', '#2ECC71', '#F1C40F'";
  const minColorsToUse = Math.min(highlightColors.length > 0 ? highlightColors.length : 4, 4);

  const prompt = `
You are an expert headline stylist. Your task is to enhance the following headline using ONLY HTML <span style="color: HEX_COLOR_CODE;"> tags for emphasis.
The headline is in ${languageName}.
Original headline: "${originalHeadline}"

Instructions for styling:
1.  ONLY use <span style='color: YOUR_CHOSEN_HEX_COLOR;'> tags. YOUR_CHOSEN_HEX_COLOR must be a valid hex color code (e.g., #FF0000).
2.  DO NOT use any other HTML tags like <b>, <em>, <i>, <u>, <strong>, etc. Do not change font weight or font style.
3.  Choose colors EXCLUSIVELY from this list: [${colorsToSuggest}].
4.  Apply AT LEAST ${minColorsToUse} DIFFERENT colors from the list to different words or meaningful phrases if the headline is long enough and the color palette allows. If the list has fewer unique colors than ${minColorsToUse}, use as many unique colors from the list as possible.
5.  Distribute colors thoughtfully to create a visually appealing and engaging headline. Each word or phrase you color should have its own <span> tag.
6.  Ensure the output is ONLY the HTML-enhanced string. No explanations, no markdown (like \`\`\`html ... \`\`\`), no "html:" prefix. Just the raw HTML.

Example: If original is "Important News Update Today" and colors are ['#FF0000', '#00FF00', '#0000FF', '#FFFF00'], a good response might be:
"<span style='color: #FF0000;'>Important</span> <span style='color: #00FF00;'>News</span> <span style='color: #0000FF;'>Update</span> <span style='color: #FFFF00;'>Today</span>"

Now, style the original headline: "${originalHeadline}" based on these rules using colors from [${colorsToSuggest}].
`;
  try {
    const response: GenerateContentResponse = await client.models.generateContent({
        model: TEXT_MODEL_NAME,
        contents: prompt,
        config: { temperature: 0.5 }
    });
    let htmlHeadline = response.text.trim();
    
    const htmlFenceRegex = /^```html\s*\n?(.*?)\n?\s*```$/s;
    const fenceMatch = htmlHeadline.match(htmlFenceRegex);
    if (fenceMatch && fenceMatch[1]) {
        htmlHeadline = fenceMatch[1].trim();
    }
    if (htmlHeadline.toLowerCase().startsWith("html:")) {
        htmlHeadline = htmlHeadline.substring(5).trim();
    }

    if (!htmlHeadline.includes("<span")) {
        console.warn("AI response for highlighted headline did not contain <span> tags. Falling back to original.", htmlHeadline);
        return originalHeadline;
    }

    return htmlHeadline || originalHeadline;
  } catch (error) {
    console.error("Error getting highlighted headline:", error);
    return originalHeadline; 
  }
}

export async function regenerateHeadlineByWordCount(
  originalHeadline: string,
  wordCount: number,
  languageCode: SelectedLanguageCode
): Promise<string> {
  const client = getAiClient();
  const languageName = getLanguageName(languageCode);

  const prompt = `You are an expert headline writer. Your task is to rewrite the following headline to be exactly ${wordCount} words long.
- Maintain the core meaning and sensational tone of the original headline.
- The language must be ${languageName}.
- Your output must ONLY be the new headline string. No explanations, no quotes, no extra text.

Original Headline: "${originalHeadline}"

Rewrite the headline in exactly ${wordCount} words.`;

  try {
    const response: GenerateContentResponse = await client.models.generateContent({
        model: TEXT_MODEL_NAME,
        contents: prompt,
        config: { temperature: 0.8 }
    });
    return response.text.trim().replace(/^"|"$/g, ''); // Trim and remove quotes
  } catch (error) {
    console.error("Error regenerating headline by word count:", error);
    return originalHeadline; // Fallback to original
  }
}

export async function generateAiArticleImage(originalHeadline: string, languageCode: SelectedLanguageCode): Promise<string> {
  const client = getAiClient();
  const languageName = getLanguageName(languageCode);
  const prompt = `Generate a photorealistic image suitable for a news article or content card titled: "${originalHeadline}".
Consider the cultural context of ${languageName} if the language is not English.
The image should be visually appealing, with cinematic lighting and high detail. Aspect ratio should be 1:1 (square).
Focus on creating an image that is directly relevant to the headline's main subject or theme.
IMPORTANT: The image must NOT contain any text, words, letters, writing, watermarks, signatures, fonts, or characters.
`;
  try {
    const response: GenerateImagesResponse = await client.models.generateImages({
        model: IMAGE_MODEL_NAME,
        prompt: prompt,
        config: { 
            numberOfImages: 1, 
            outputMimeType: 'image/jpeg'
        }
    });
    if (response.generatedImages && response.generatedImages.length > 0 && response.generatedImages[0].image.imageBytes) {
      const base64ImageBytes = response.generatedImages[0].image.imageBytes;
      return `data:image/jpeg;base64,${base64ImageBytes}`;
    }
    throw new Error("No image generated or image data missing.");
  } catch (error) {
    throw handleApiError(error, 'generateAiArticleImage');
  }
}

export async function generateAiObjectImage(objectQuery: string): Promise<string> {
    const client = getAiClient();
    const prompt = `Generate a photorealistic, high-detail, circular cropped image of a single object: '${objectQuery}'.
The object should be centered on a solid, light gray background (#f0f0f0).
The final image should be perfectly square. Do not include any text or watermarks.`;

    try {
        const response: GenerateImagesResponse = await client.models.generateImages({
            model: IMAGE_MODEL_NAME,
            prompt: prompt,
            config: { numberOfImages: 1, outputMimeType: 'image/png' } // PNG for potential transparency
        });
        if (response.generatedImages && response.generatedImages.length > 0 && response.generatedImages[0].image.imageBytes) {
            const base64ImageBytes = response.generatedImages[0].image.imageBytes;
            return `data:image/png;base64,${base64ImageBytes}`;
        }
        throw new Error("No object image generated or image data missing.");
    } catch (error) {
        throw handleApiError(error, 'generateAiObjectImage');
  }
}

export async function processUserPrompt(prompt: string, settingsOptions: any): Promise<AiProcessedPrompt> {
    const client = getAiClient();
    const systemInstruction = `
You are a helpful AI assistant for a content generation web application. Your task is to understand the user's prompt and respond with a JSON object that the application can use to perform an action.

The user can ask to:
1.  **Update Settings**: Change the visual appearance or content parameters of the cards.
2.  **Generate Content**: Ask for new content cards based on a topic.
3.  **Answer a Question**: Ask a general question not related to settings or content generation.

You MUST respond with a single, valid JSON object with the following structure:
{
  "action": "update_settings" | "generate_content" | "answer_question",
  "settings": { ... }, // ONLY if action is "update_settings". Contains only the keys for settings the user wants to change.
  "content_prompt": "...", // ONLY if action is "generate_content". This should be a clear, self-contained instruction for generating content.
  "answer": "..." // ONLY if action is "answer_question".
}

--- SETTINGS SCHEMA ---
Here are the available settings and their valid options. When updating a setting, you MUST use one of the specified value formats.
${JSON.stringify(settingsOptions, null, 2)}
--- END SETTINGS SCHEMA ---

--- EXAMPLES ---
User Prompt: "Make 5 posts about technology for the USA in hindi"
Your JSON response:
{
  "action": "generate_content",
  "content_prompt": "Generate 5 technology news posts for the USA in Hindi language"
}

User Prompt: "change the headline font to Boogaloo and make the text size 48px"
Your JSON response:
{
  "action": "update_settings",
  "settings": {
    "headlineFontFamily": "Boogaloo, cursive",
    "headlineTextSize": 48
  }
}

User Prompt: "who are you?"
Your JSON response:
{
  "action": "answer_question",
  "answer": "I am an AI assistant integrated into this application to help you generate content and customize its appearance."
}
---

Now, analyze the following user prompt and generate the appropriate JSON response.

User Prompt: "${prompt}"
`;
    
    try {
        const response = await client.models.generateContent({
            model: TEXT_MODEL_NAME,
            contents: systemInstruction,
            config: {
                responseMimeType: "application/json",
                temperature: 0.1, // Low temperature for predictable JSON output
            },
        });
        const parsedData = parseJsonFromMarkdown(response.text);
        
        // Basic validation of the returned structure
        if (!parsedData.action || !['update_settings', 'generate_content', 'answer_question'].includes(parsedData.action)) {
            throw new Error('AI response has invalid or missing action.');
        }

        return parsedData as AiProcessedPrompt;
    } catch (error) {
        throw handleApiError(error, 'processUserPrompt');
    }
}

// --- NEW VIRAL POST FUNCTIONS ---

export interface ViralPostContent {
    headline: string;
    summary: string;
    image_prompt: string;
}

export async function generateViralPostContent(topic: string): Promise<ViralPostContent> {
  const client = getAiClient();
  const prompt = `
You are an expert in creating viral social media content for a South Asian audience. Your task is to take a topic and generate a content package for a viral image post.

The user's topic is: "${topic}"

You MUST generate a JSON object with the following structure:
{
  "headline": "A 4-6 word emotional or shocking headline in bold Hinglish or Hindi.",
  "summary": "A 1-2 sentence summary explaining the context of the headline, in Hinglish or Hindi.",
  "image_prompt": "A detailed, dramatic, and photorealistic prompt for an AI image generator (like Imagen 3) to create the background image. The image should be symbolic, emotional, and visually striking. Describe the scene, mood, and lighting. The image MUST be square (1:1 aspect ratio). Do not include any text in the image prompt."
}

Example for topic "Youth selling kidneys for iPhones":
{
  "headline": "iPhone के लिए बेच दी किडनी!",
  "summary": "एक नए आईफोन के लिए अपनी किडनी बेचने वाले युवाओं की चौंकाने वाली कहानी, जो उपभोक्तावाद के अंधेरे पक्ष पर प्रकाश डालती है।",
  "image_prompt": "A dramatic, dimly lit scene in a slum alley. A young, distressed person is sitting on a stool, clutching a brand new smartphone box while looking at a fresh scar on their side. The mood is desperate and somber. Photorealistic, cinematic lighting, square format, 1:1 aspect ratio."
}

Now, generate the content package for the topic: "${topic}"
`;

    try {
        const response = await client.models.generateContent({
            model: TEXT_MODEL_NAME,
            contents: prompt,
            config: { responseMimeType: "application/json", temperature: 0.7 }
        });
        const parsed = parseJsonFromMarkdown(response.text);
        if (!parsed.headline || !parsed.summary || !parsed.image_prompt) {
            throw new Error("AI response for viral post did not contain the required fields.");
        }
        return parsed;
    } catch (error) {
        throw handleApiError(error, 'generateViralPostContent');
    }
}

export async function analyzeAndGenerateViralContent(
    imageData: { mimeType: string; data: string },
    customCaption?: string
): Promise<ViralRecreationContent> {
    const client = getAiClient();
    const prompt = `
You are an expert at analyzing viral social media images to deconstruct and recreate them.
The user has provided an image and optional context. Your task is to analyze the image, extract its core components, and provide a JSON object to recreate a similar, new post.

**ANALYSIS INSTRUCTIONS:**
1.  **Analyze Text Position:** Examine the image for any text. Determine if the text is located in a distinct **top/header section** or a distinct **bottom/footer section**. Text that is part of the main central image (like in a meme) is NOT considered a header or footer.
2.  **Extract Headline:**
    *   Identify text that is clearly located in a distinct **top/header section** of the image.
    *   Combine all text lines from this header section into a single string for the 'headline' field. Use '\\n' for line breaks if there are multiple lines.
    *   **CRITICAL RULE:** If you cannot find any text in a clear, distinct top/header section, the 'headline' field in your JSON output **MUST** be an empty string (""). **DO NOT INVENT A HEADLINE.**
3.  **Extract Summary:**
    *   Identify text that is clearly located in a distinct **bottom/footer section** of the image.
    *   Combine this text into a single string for the 'summary' field.
    *   If no text is found in a distinct bottom/footer section, the 'summary' field **MUST** be an empty string ("").
4.  **Analyze Art Style & Image Content:**
    *   Look at the visual style of the original image (e.g., 'photograph', 'cartoon', 'comic book art', '3D render', 'oil painting', 'anime style'). This is a critical step.
    *   Analyze the central, main image content, **ignoring any text overlays**.
    *   Based on your analysis, write a detailed prompt for an AI image generator (like Imagen 3) to create a NEW, similar but distinct image.
    *   The prompt MUST include the art style you identified. It should describe the scene, subject, mood, and lighting.
    *   The prompt MUST be for a square (1:1) image and **MUST explicitly command the AI to "Do not generate any text, words, or letters in the image."**

**OUTPUT FORMAT:**
You MUST respond with a single, valid JSON object with the following structure:
{
  "headline": "Extracted header text, or an empty string if none exists.",
  "summary": "Extracted footer text, or an empty string if none exists.",
  "image_prompt": "The new, detailed prompt for the image generator, including the art style and a command not to generate text."
}

**Example 1 (Image with Header):**
{
  "headline": "MY CLOTHES",
  "summary": "MY SOCKS",
  "image_prompt": "A two-panel vertical collage. The top panel shows a photorealistic black crow standing in green grass. The bottom panel shows a photorealistic, colorful lorikeet parrot. Cinematic lighting, square 1:1 aspect ratio. Do not generate any text, words, or letters in the image."
}

**Example 2 (Meme image with no clear header/footer):**
{
  "headline": "",
  "summary": "",
  "image_prompt": "A photorealistic, emotional image of a cat looking sadly out a window on a rainy day. Cinematic, moody lighting. Square 1:1 aspect ratio. Do not generate any text, words, or letters in the image."
}

Now, analyze the provided image and the user's optional context: "${customCaption || 'No context provided.'}". Generate the JSON object according to all instructions.
`;

    const imagePart = { inlineData: { mimeType: imageData.mimeType, data: imageData.data } };
    const textPart = { text: prompt };

    try {
        const response = await client.models.generateContent({
            model: TEXT_MODEL_NAME,
            contents: { parts: [imagePart, textPart] },
            config: { responseMimeType: "application/json", temperature: 0.5 }
        });
        const parsed = parseJsonFromMarkdown(response.text);
        if (parsed.headline === undefined || parsed.summary === undefined || !parsed.image_prompt) {
            throw new Error("AI response for viral recreation did not contain the required fields (headline, summary, image_prompt).");
        }
        return parsed;
    } catch (error) {
        throw handleApiError(error, 'analyzeAndGenerateViralContent');
    }
}


export async function generateViralImage(prompt: string): Promise<string> {
    const client = getAiClient();
    try {
        const response: GenerateImagesResponse = await client.models.generateImages({
            model: IMAGE_MODEL_NAME,
            prompt: prompt,
            config: { 
                numberOfImages: 1, 
                outputMimeType: 'image/jpeg'
            }
        });
        if (response.generatedImages && response.generatedImages.length > 0 && response.generatedImages[0].image.imageBytes) {
            const base64ImageBytes = response.generatedImages[0].image.imageBytes;
            return `data:image/jpeg;base64,${base64ImageBytes}`;
        }
        throw new Error("No viral image generated or image data missing.");
    } catch (error) {
        throw handleApiError(error, 'generateViralImage');
    }
}

export async function generateCaptionFromText(
    sourceText: string,
    mode: 'demo' | 'filename'
): Promise<string> {
    const client = getAiClient();
    const prompt = mode === 'demo'
        ? `You are an expert social media manager. The user has provided a sample caption: "${sourceText}". 
           Create a new, engaging, and slightly different caption based on this sample. 
           Maintain a similar tone but rephrase it to sound fresh. 
           Include 3-5 relevant and popular hashtags.
           Finally, append a short, engaging call-to-action (CTA) on a new line to encourage user interaction (e.g., "What are your thoughts?", "Tag a friend who can relate!", "Let us know in the comments!").
           The output should be ONLY the caption text. No explanations.`
        : `You are an expert social media manager. An image has been uploaded with the filename: "${sourceText}".
           Based on this filename, generate a creative and engaging caption for a social media post.
           The caption should be descriptive and interesting.
           Include 3-5 relevant and popular hashtags based on the filename.
           Finally, append a short, engaging call-to-action (CTA) on a new line to encourage user interaction (e.g., "What do you think?", "Tag a friend!", "Let me know your reaction below.").
           The output should be ONLY the caption text. No explanations.`;

    try {
        const response = await client.models.generateContent({
            model: TEXT_MODEL_NAME,
            contents: prompt,
            config: { temperature: 0.7 }
        });
        return response.text.trim();
    } catch (error) {
        console.error("Error generating caption:", error);
        return `${sourceText.replace(/[-_]/g, ' ')}\n\n#general #post\nWhat do you think?`;
    }
}

export async function generateCaptionFromImage(
    imageData: { mimeType: string; data: string },
    languageCode: SelectedLanguageCode,
    contextText?: string // e.g., original caption
): Promise<string> {
    const client = getAiClient();
    const languageName = LanguageOptions[languageCode] || 'English';
    
    const contextInstruction = contextText 
        ? `The original post's caption was: "${contextText}". Use this for context but create a new, fresh caption.`
        : 'The image is being uploaded for the first time.';

    const prompt = `
You are a world-class social media manager, an expert in creating viral, human-like content for Facebook, especially for an Indian and global audience.
Your task is to analyze the provided image and generate a perfect post caption.

**IMAGE CONTEXT:**
Analyze the image provided. It is the primary content for the post.
${contextInstruction}

**INSTRUCTIONS:**
1.  **Caption Language**: The main caption body (hook, informative body, emojis, CTA) MUST be in **${languageName}**.
2.  **Hashtag Language**: The hashtags MUST be in **English** for maximum reach.
3.  **Structure & Tone**:
    *   **Hook**: Start with a strong, attention-grabbing question or statement in ${languageName}.
    *   **Informative Body**: Write an informative, easy-to-understand paragraph describing the image in ${languageName}. Make it feel personal and authentic.
    *   **Emojis**: Naturally weave in 3-4 relevant emojis to add visual appeal and emotion.
    *   **Call-to-Action**: End with an engaging question in ${languageName} to encourage comments.
4.  **Hashtags**: After the main caption, on new lines, add 5-6 relevant and popular hashtags in English.
5.  **Final Output**: Your output MUST be ONLY the new caption text. Do not add any extra explanations, markdown, or prefixes.

**Example Output Format (for a Hindi caption):**
"क्या आपने कभी ऐसा कुछ देखा है? 😲

यह तस्वीर [तस्वीर का वर्णन] दिखाती है। यह मुझे सोचने पर मजबूर कर देता है...

आप इसके बारे में क्या सोचते हैं? नीचे कमेंट्स में बताएं! 👇

#englishhashtag #amazingview #incredibleindia #viralpost #trendingnow"

Now, generate the caption for the provided image. The main caption text must be in ${languageName}, and the hashtags must be in English.
`;

    const imagePart = { inlineData: { mimeType: imageData.mimeType, data: imageData.data } };
    const textPart = { text: prompt };

    try {
        const response = await client.models.generateContent({
            model: TEXT_MODEL_NAME,
            contents: { parts: [imagePart, textPart] },
            config: { temperature: 0.7 }
        });
        return response.text.trim();
    } catch (error) {
        throw handleApiError(error, 'generateCaptionFromImage');
    }
}


export async function urlToBase64(url: string): Promise<{ mimeType: string; data: string } | null> {
    try {
        // NOTE: Direct fetch may encounter CORS issues. A backend proxy is recommended for robust fetching.
        const response = await fetch(url);
        if (!response.ok) {
            console.error(`Failed to fetch image directly: ${response.statusText}`);
            return null;
        }
        const blob = await response.blob();
        const mimeType = blob.type;
        if (!mimeType.startsWith('image/')) {
            console.error('Fetched file is not an image:', mimeType);
            return null;
        }
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                if (typeof reader.result === 'string') {
                    const base64data = reader.result.split(',')[1];
                    resolve({ mimeType, data: base64data });
                } else {
                    reject(new Error('Failed to read blob as data URL.'));
                }
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    } catch (error) {
        console.error("Error converting URL to Base64 directly:", error);
        return null;
    }
}


export async function generateSingleBestReply(
    postCaption: string,
    commentText: string,
    commenterInfo: { name: string; id: string } | null,
    customCta: string,
    mentionName: boolean,
    useImageContext: boolean,
    imageUrl: string | null
): Promise<string> {
    const client = getAiClient();

    const ctaInstruction = customCta.trim()
        ? `5.  **Add Call to Action (CTA):** After your reply and question, on a new line, add the following text exactly: "${customCta}"`
        : `5.  **Do not add any call to action.**`;

    const mentionPreamble = mentionName && commenterInfo?.name
        ? `Your reply MUST start by addressing the user by their name: "${commenterInfo.name}". This is a strict rule. For example, begin your reply with "${commenterInfo.name}, ".`
        : `Do not address the user by name.`;
    
    let exampleReply = "Thanks for your comment! 🙏 What did you like most about this?";
    if (mentionName && commenterInfo?.name) {
        exampleReply = `John Doe, thanks for your comment! 🙏 What did you like most about this?`;
    }
    if (customCta.trim()) {
        exampleReply += `\n${customCta}`;
    }

    let requestParams: GenerateContentParameters;
    let fallbackToText = false;

    // Common prompt structure
    const getPrompt = (isImage: boolean) => `
As an expert social media manager, analyze the ${isImage ? '**POST IMAGE**, the ' : ''}**POST CAPTION**, and the **USER'S COMMENT**, then craft the single best reply.

**Post Caption Context:** "${postCaption || 'No specific caption provided.'}"
**User's Comment:** "${commentText}"

**Your Task:**
1.  **Analyze and Detect Language:** Read the user's comment to understand its language (e.g., Hindi, English, Hinglish). Your reply MUST be in the same language.
2.  **Address the User:** ${mentionPreamble}
3.  **Craft the Reply:** Write a reply that is relevant to the ${isImage ? 'image, ' : ''}caption, and comment.
4.  **Engage:** Naturally integrate 1-2 relevant emojis (e.g., 🙏, 😊, 🔥) and end your main reply with an open-ended question to encourage further conversation.
${ctaInstruction}

**Example Reply Format:**
\`\`\`
${exampleReply}
\`\`\`

**Your Final Output MUST be ONLY the reply text, formatted as shown in the example.** Do not add any extra explanations or markdown fences.
`;

    if (useImageContext && imageUrl) {
        const imageDetails = await urlToBase64(imageUrl);

        if (imageDetails) {
            const imagePart = { inlineData: { mimeType: imageDetails.mimeType, data: imageDetails.data } };
            const textPrompt = getPrompt(true);
            requestParams = {
                model: TEXT_MODEL_NAME,
                contents: { parts: [imagePart, { text: textPrompt }] },
                config: { temperature: 0.8 }
            };
        } else {
            console.warn("Could not process image, falling back to text-only reply.");
            fallbackToText = true;
        }
    }

    if (!useImageContext || !imageUrl || fallbackToText) {
        const textPrompt = getPrompt(false);
        requestParams = {
            model: TEXT_MODEL_NAME,
            contents: textPrompt,
            config: { temperature: 0.8 }
        };
    }

    try {
        const response = await client.models.generateContent(requestParams!);
        return response.text.trim().replace(/^```|```$/g, '').trim();
    } catch (error) {
        throw handleApiError(error, 'generateSingleBestReply');
    }
}


export async function getPageInsights(jsonData: string, pageName: string): Promise<string> {
    const client = getAiClient();
    const prompt = `
    Analyze the following Facebook Page insights data for the page named "${pageName}". The data is in JSON format.
    JSON Data: ${jsonData}

    Based on this data, provide 3 concise, actionable, and data-driven tips to help the user increase their engagement and follower growth.
    Structure your response as a simple string, with each tip on a new line. Start each tip with a number (1., 2., 3.).
    Focus on identifying high-performing content, trends in follower growth, and suggestions for improving reach.
    Keep the tone encouraging and professional. Be specific in your advice.

    Example format for engagement data:
    1. Your top post about [Topic Name] received high engagement. Create more content on similar topics to boost interaction.
    2. Your follower growth spiked on Saturday. This suggests your audience is most active on weekends. Plan key posts for Saturdays.
    3. You have a high number of new followers but lower engagement. Try asking more questions in your captions to encourage comments and build community.
    `;

    try {
        const response = await client.models.generateContent({
            model: TEXT_MODEL_NAME,
            contents: prompt,
            config: { temperature: 0.6 }
        });
        return response.text.trim();
    } catch (error) {
        throw handleApiError(error, 'getPageInsights');
    }
}

export async function generateCrossPostCaption(originalCaption: string, languageCode: SelectedLanguageCode): Promise<string> {
    const client = getAiClient();
    const languageName = getLanguageName(languageCode);
    const prompt = `
You are an expert social media manager specializing in creating viral, human-like content.
Your task is to rewrite an original caption into a new, long, descriptive, and aesthetically pleasing paragraph for cross-posting.

Original Caption: "${originalCaption || 'An interesting image.'}"

Instructions:
1.  **Language:** The main body of the caption (hook, story, CTA) MUST be written in **${languageName}**.
2.  **Hashtags:** The hashtags MUST be written in **English**.
3.  **Start with a Hook:** Begin the caption with a strong, attention-grabbing question or statement to immediately stop the scroll.
4.  **Adopt a Storytelling Tone:** Rewrite the original caption into a new, long, descriptive, and human-like paragraph in ${languageName}. Use a conversational, storytelling tone.
5.  **Incorporate Emojis:** Naturally weave in 3-4 relevant emojis.
6.  **Add a Call-to-Action:** End with an engaging question in ${languageName}.
7.  **Add Hashtags:** On new lines after the main caption, add 5-6 relevant and popular hashtags in English.

Example (for Hindi):
- Original Caption: "Amazing sunset today!"
- Your Output:
"क्या आपने कभी इतना खूबसूरत सूर्यास्त देखा है जो आपको बस रोक दे? 🌅

आज शाम मेरी कुछ ऐसी ही थी। आकाश नारंगी, गुलाबी और बैंगनी रंग के सबसे अविश्वसनीय रंगों में रंगा हुआ था। ये ऐसे पल होते हैं जो आपको रुकने और अपने आस-पास की साधारण सुंदरता की सराहना करने की याद दिलाते हैं। सचमुच जादुई! ✨🧡

आपने अब तक का सबसे खूबसूरत सूर्यास्त कौन सा देखा है? नीचे बताएं! 👇

#sunsetlovers #beautifulsky #naturephotography #skyonfire #eveningvibes #peacefulmoments"

**Your final output MUST be ONLY the new caption text, formatted as shown above.** Do not add any extra explanations.
Now, rewrite this caption: "${originalCaption}" in ${languageName} with English hashtags.
`;
    try {
        const response = await client.models.generateContent({
            model: TEXT_MODEL_NAME,
            contents: prompt,
            config: {
                temperature: 0.8
            }
        });
        return response.text.trim();
    } catch (error) {
        console.error("Error generating cross-post caption:", error);
        return `${originalCaption || ''}\n\n#crosspost #repost #post`; // Fallback
    }
}

export async function generateMessageReply(
    conversationHistory: { from: string; message: string }[],
    pageName: string,
    imageUrl: string | null,
    customCta: string
): Promise<string> {
    const client = getAiClient();
    const historyText = conversationHistory
        .map(msg => `${msg.from}: ${msg.message}`)
        .join('\n');

    const lastUserMessage = conversationHistory.filter(m => m.from !== 'Page').pop();
    const languageHint = lastUserMessage ? `The user is likely speaking the same language as in this message: "${lastUserMessage.message}". Your reply must be in the same language.` : 'Reply in a friendly, generic tone.';

    const imageInstruction = imageUrl
        ? `Additionally, an image was shared in the conversation. Analyze the image at this URL: ${imageUrl}. Your reply should be relevant to this image as well as the text conversation.`
        : 'No image was provided, base your reply only on the text conversation.';
    
    const ctaInstruction = customCta.trim()
        ? `IMPORTANT: After your main reply and any question you ask, on a new line, add the following text EXACTLY: "${customCta}"`
        : `Do not add any call-to-action or promotional text at the end.`;

    const prompt = `
You are a helpful and very friendly customer support agent and social media manager for the Facebook Page named "${pageName}".
Your task is to provide a warm, helpful, and human-like reply to a user's message based on the recent conversation history and any provided image.

**Conversation History:**
${historyText}

**Image Context:**
${imageInstruction}

**Your Task:**
1.  Read the conversation history and analyze the image (if provided) to understand the user's query or comment.
2.  ${languageHint}
3.  Write a reply that is relevant and helpful. Do not sound like a robot. Use emojis where appropriate to make the conversation feel natural and friendly (like 😊, 🙏, 👍).
4.  If it makes sense, end your main reply with a relevant, open-ended question to encourage further conversation.
5.  ${ctaInstruction}
6.  DO NOT repeat the user's question. DO NOT add any extra text like "Here is your reply:". Just provide the reply text itself.

Based on the context, what is the best reply from the "${pageName}" Page?
`;
    try {
        const response = await client.models.generateContent({
            model: TEXT_MODEL_NAME,
            contents: prompt,
            config: { temperature: 0.8 }
        });
        return response.text.trim();
    } catch (error) {
        throw handleApiError(error, 'generateMessageReply');
    }
}


export async function generateFollowUpQuestions(
    conversationHistory: { from: string; message: string }[]
): Promise<string> {
     const client = getAiClient();
     const historyText = conversationHistory
        .map(msg => `${msg.from}: ${msg.message}`)
        .join('\n');
    
    const prompt = `
You are a conversation analysis expert. Based on the following conversation history, your task is to generate 5 insightful follow-up questions.
The goal of these questions is to better understand the user's needs, clarify their query, or explore related topics to provide better assistance.

**Conversation History:**
${historyText}

**Instructions:**
1.  Analyze the user's messages and the page's replies.
2.  Generate 5 open-ended questions that are directly related to the conversation.
3.  The questions should be designed to encourage a detailed response from the user.
4.  Return ONLY the questions as a single string. Each question should be on a new line and numbered from 1 to 5.
5.  Do not add any preamble like "Here are the questions:" or any other text.

**Example output format:**
1. Could you tell me more about [specific topic]?
2. What was your main goal when you first reached out?
3. Have you considered [related option]?
4. What does your ideal solution look like?
5. Is there anything else I can help clarify?

Now, generate the 5 follow-up questions based on the provided conversation history.
`;
     try {
        const response = await client.models.generateContent({
            model: TEXT_MODEL_NAME,
            contents: prompt,
            config: { temperature: 0.7 }
        });
        return response.text.trim();
    } catch (error) {
        throw handleApiError(error, 'generateFollowUpQuestions');
    }
}

export async function generatePostFromTopics(topics: string[]): Promise<string> {
    const client = getAiClient();
    const prompt = `
    You are an expert social media content creator. Your task is to write a highly engaging Facebook post.

    The main topics to include are: ${topics.join(', ')}.

    Instructions:
    1.  Create a compelling and click-worthy headline.
    2.  Write a short, engaging body text that elaborates on the topics.
    3.  Use a conversational and slightly sensational tone suitable for a broad audience.
    4.  Incorporate 2-3 relevant emojis naturally.
    5.  Include 4-5 relevant hashtags at the end.
    6.  The output should be ONLY the post text. No explanations or extra formatting.
    `;
    try {
        const response = await client.models.generateContent({
            model: TEXT_MODEL_NAME,
            contents: prompt,
            config: { temperature: 0.7 }
        });
        return response.text.trim();
    } catch (error) {
        throw handleApiError(error, 'generatePostFromTopics');
    }
}

export async function translateSrtScript(
    srtContent: string
): Promise<string> {
    const client = getAiClient();
    const prompt = `Act as an expert script adapter for a top Indian YouTube channel that specializes in movie recaps and explanations. Your target audience is Indian Gen Z and millennials who are accustomed to fast-paced, engaging online content.
Your primary mission is to translate the provided Chinese SRT file into a captivating Hindi narrative script. This is not a literal translation. You must transform the content into an exciting explanation that hooks the viewer from the first second and keeps them watching.
Follow these critical directives:
1. The Ultimate Hook (Title & Opening):
Title: First, analyze the entire SRT script to understand the core conflict, twist, or most shocking element. Based on this, craft a punchy, curiosity-driven, or suspense title in Hindi. The title must create a "suspense" that makes viewers need to click.
Opening Hook: Discard the original first line of the SRT. Replace the first subtitle (or combine the first two if needed) with a powerful opening suspense hook that grabs immediate attention and sets up the central question or theme of the story.
2. Narrative Transformation:
Dialogue to Narration: Convert all conversations into an explanatory third-person narrative. Instead of translating dialogue directly, describe what is happening and what is being said, as if you are a narrator telling the story. For example, instead of translating "A: Where are you going? B: To the store," you should write something like, "कहानी में ट्विस्ट तब आता है जब वो उससे पूछता है कि वो कहाँ जा रहा है।"
Continuous Re-engagement: Throughout the script, strategically place "re-hooks"—small cliffhangers, intriguing questions, or foreshadowing statements—at the end of key scenes to ensure the viewer remains hooked.
3. Linguistic & Cultural Style:
Modern Hinglish: Use natural, conversational Hindi that seamlessly integrates commonly spoken English words written in Devanadari script (e.g., प्रॉब्लम, सिचुएशन, शॉकिंग, प्लान, मिशन).
Cultural Resonance: Where possible, replace culturally specific Chinese concepts with relatable Indian parallels to make the story more accessible. For names, transliterate the Chinese names phonetically into Hindi (e.g., ली को ली). Avoid replacing them with Indian names unless the context is a generic fictional story where names are unimportant.
Emotional Tone: Analyze and replicate the emotional arc of the original scene—be it suspense, humor, drama, or action. Your language must evoke the same feelings.
4. Strict Formatting Rules:
No SRT Numbering: The original SRT sequence numbers have been removed. You MUST NOT add numbers back into the script. Each new subtitle line should start directly after a placeholder line.
Timestamps Placeholder: The original timestamp lines have been replaced with a placeholder "(................)". You MUST use this exact placeholder in your translated output between each subtitle line.
Single-Line Subtitles: Every translated subtitle must be on a single line. Do not use line breaks within a subtitle.
Numerals to Words: All numerical digits within the dialogue/narration must be written out as Hindi words (e.g., "100" becomes "सौ", "2" becomes "दो").
Word Count: Ensure every subtitle line has a minimum of 4-5 words to maintain a smooth narrative flow. Combine short lines or add descriptive context if necessary.
No Parentheses: Do not place parentheses around the Devanadari English words. They must be integrated directly into the sentence.
Final Output Structure:
Your final response must begin with the generated Hindi title, followed by the complete translated SRT content. Both the title and the SRT must be inside a single code block for easy copying.

Example of Final Output:
\`\`\`
[यहाँ आपका बनाया हुआ आकर्षक टाइटल आएगा]

(................)
ये कहानी एक ऐसे लड़के की है जिसके पास एक इंक्रेडIBLE पावर थी।
(................)
लेकिन उसे बिलकुल अंदाज़ा नहीं था कि ये पावर उसकी सबसे बड़ी प्रॉब्लम बनने वाली है।
\`\`\`
`;

    try {
        const response = await client.models.generateContent({
            model: TEXT_MODEL_NAME,
            contents: `${prompt}\n\nHere is the SRT file content to translate:\n\n${srtContent}`,
            config: { temperature: 0.7 }
        });
        
        let resultText = response.text.trim();
        const codeBlockRegex = /```(?:\w*\n)?([\s\S]*?)```/;
        const match = resultText.match(codeBlockRegex);
        if (match && match[1]) {
            return match[1].trim();
        }
        return resultText;

    } catch (error) {
        throw handleApiError(error, 'translateSrtScript');
    }
}

export async function fetchTrendingTopics(): Promise<string[]> {
  const client = getAiClient();
  const prompt = `
Generate a list of 8 to 10 current, viral, and highly engaging topics for social media in India. 
The topics should be sensational, controversial, shocking, or related to recent news and pop culture that would get a lot of engagement.
Provide short, punchy topics.

Return the result as a single, valid JSON array of strings.
Example:
[
  "Latest Bollywood Controversy",
  "New Government Scheme Explained",
  "Viral Social Media Challenge",
  "Shocking Scam Exposed"
]
`;

  try {
    const response = await client.models.generateContent({
      model: TEXT_MODEL_NAME,
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        temperature: 0.9,
      },
    });

    const parsed = parseJsonFromMarkdown(response.text);
    if (Array.isArray(parsed) && parsed.every(item => typeof item === 'string') && parsed.length > 0) {
      return parsed;
    }
    throw new Error("AI did not return a valid array of topic strings.");

  } catch (error) {
    console.error("Error fetching trending topics, using fallback:", error);
    // As a fallback, return the original hardcoded topics
    return [
        "Love Jihad", "Fake Babas", "Youth selling kidneys for iPhones",
        "Viral Marriage Drama", "Village banishes daughter-in-law", "Liquor tragedy in Bihar",
    ];
  }
}