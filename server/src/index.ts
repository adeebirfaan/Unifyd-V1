import { existsSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import vision from '@google-cloud/vision';

import { createApp } from './app.js';

if (existsSync('.env')) process.loadEnvFile('.env');

const url = process.env.SUPABASE_URL;
const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;
if (!url || !publishableKey) throw new Error('Set SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY in server/.env.');

const port = Number(process.env.PORT ?? 3001);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be a valid TCP port.');
const host = process.env.OCR_HOST?.trim() || '127.0.0.1';

// This client has only the public project key. getUser(token) verifies each caller with Supabase Auth.
const supabase = createClient(url, publishableKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
// Application Default Credentials are discovered by the official Google client library.
const visionClient = new vision.ImageAnnotatorClient();

const app = createApp({
  verifyToken: async (token) => {
    const { data, error } = await supabase.auth.getUser(token);
    return !error && Boolean(data.user?.id);
  },
  detectText: async (image) => {
    const [result] = await visionClient.documentTextDetection({ image: { content: image } });
    if (result.error) throw new Error('Vision detection failed.');
    return result.fullTextAnnotation?.text ?? result.textAnnotations?.[0]?.description ?? '';
  },
});

app.listen(port, host, () => {
  console.info(`Unifyd OCR service listening on ${host}:${port}`);
});
