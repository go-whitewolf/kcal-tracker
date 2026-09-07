/**
 * Cloudflare Worker — прокси към Claude API.
 * Ключът стои като secret в Cloudflare, не в браузъра.
 *
 * Разгръщане:
 *   npm i -g wrangler
 *   wrangler login
 *   wrangler secret put ANTHROPIC_API_KEY
 *   wrangler secret put SHARED_SECRET      # по избор, вж. по-долу
 *   wrangler deploy
 *
 * После сложи адреса на worker-a в „Профил → през собствен прокси адрес“.
 */

const ALLOWED_ORIGINS = [
  'http://localhost:8080',
  'https://go-whitewolf.github.io'
];

const cors = origin => ({
  'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'content-type, x-shared-secret',
  'Access-Control-Max-Age': '86400'
});

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors(origin) });
    }
    if (request.method !== 'POST') {
      return new Response('Само POST.', { status: 405, headers: cors(origin) });
    }
    if (env.SHARED_SECRET && request.headers.get('x-shared-secret') !== env.SHARED_SECRET) {
      return new Response('Нямаш достъп.', { status: 403, headers: cors(origin) });
    }

    const body = await request.text();

    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body
    });

    return new Response(upstream.body, {
      status: upstream.status,
      headers: { ...cors(origin), 'content-type': 'application/json' }
    });
  }
};
