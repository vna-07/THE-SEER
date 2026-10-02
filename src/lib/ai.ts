import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
const MODEL = process.env.GEMINI_MODEL ?? 'gemini-3.5-flash-lite';

async function withRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  let lastErr: unknown;

  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e: any) {
      lastErr = e;
      const msg = JSON.stringify(e?.error ?? e?.message ?? e);
      const retryable =
        msg.includes('503') ||
        msg.includes('UNAVAILABLE') ||
        msg.includes('429') ||
        msg.includes('overloaded');
      if (!retryable || i === attempts - 1) throw e;
      await new Promise((r) => setTimeout(r, 1500 * (i + 1)));
    }
  }

  throw lastErr;
}

export async function askText(system: string, user: string, jsonMode = false): Promise<string> {
  const opts = {
    systemInstruction: system,
    responseMimeType: jsonMode ? 'application/json' : 'text/plain',
    temperature: jsonMode ? 0.1 : 0.7,
  };

  const res = await withRetry(() =>
    ai.models.generateContent({ model: MODEL, contents: user, config: opts })
  );

  return res.text ?? '';
}

export async function askVision(
  system: string,
  prompt: string,
  imageDataUrl: string,
  jsonMode = false
): Promise<string> {
  const parts: any[] = [{ text: prompt }];

  if (imageDataUrl.startsWith('data:')) {
    const [meta, b64] = imageDataUrl.split(',');
    const mime = meta.match(/data:(.*?);/)?.[1] ?? 'image/jpeg';
    parts.push({ inlineData: { mimeType: mime, data: b64 } });
  } else {
    parts.push({ fileData: { fileUri: imageDataUrl, mimeType: 'image/jpeg' } });
  }

  const opts = {
    systemInstruction: system,
    responseMimeType: jsonMode ? 'application/json' : 'text/plain',
    temperature: 0.1,
  };

  const res = await withRetry(() =>
    ai.models.generateContent({
      model: MODEL,
      contents: [{ role: 'user', parts }],
      config: opts,
    })
  );

  return res.text ?? '';
}
