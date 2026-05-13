const fs = require('fs');
const path = require('path');

const KV_KEY = 'hb_site_content_v1';

function readDefaultContent() {
  try {
    const contentPath = path.join(process.cwd(), 'content.json');
    const raw = fs.readFileSync(contentPath, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    return { nav: {}, sections: {} };
  }
}

function defaultPayload() {
  return {
    content: readDefaultContent(),
    textOverrides: [],
    imageKeyOverrides: {},
    imageSelectorOverrides: []
  };
}

function sanitizePayload(value) {
  const fallback = defaultPayload();
  const input = value && typeof value === 'object' ? value : {};

  return {
    content: input.content && typeof input.content === 'object' ? input.content : fallback.content,
    textOverrides: Array.isArray(input.textOverrides) ? input.textOverrides : [],
    imageKeyOverrides: input.imageKeyOverrides && typeof input.imageKeyOverrides === 'object' ? input.imageKeyOverrides : {},
    imageSelectorOverrides: Array.isArray(input.imageSelectorOverrides) ? input.imageSelectorOverrides : []
  };
}

function getKvConfig() {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  return { url, token };
}

async function kvGet(config, key) {
  const response = await fetch(config.url + '/get/' + encodeURIComponent(key), {
    method: 'GET',
    headers: {
      Authorization: 'Bearer ' + config.token
    }
  });

  if (!response.ok) {
    throw new Error('KV get failed with status ' + response.status);
  }

  const data = await response.json();
  return data && Object.prototype.hasOwnProperty.call(data, 'result') ? data.result : null;
}

async function kvSet(config, key, value) {
  const response = await fetch(config.url + '/set/' + encodeURIComponent(key), {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + config.token,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(value)
  });

  if (!response.ok) {
    throw new Error('KV set failed with status ' + response.status);
  }
}

module.exports = async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');

  const kvConfig = getKvConfig();

  if (req.method === 'GET') {
    if (!kvConfig) {
      return res.status(200).json({
        ok: true,
        mode: 'fallback',
        data: defaultPayload()
      });
    }

    try {
      const stored = await kvGet(kvConfig, KV_KEY);
      const payload = stored ? sanitizePayload(stored) : defaultPayload();
      return res.status(200).json({ ok: true, mode: 'kv', data: payload });
    } catch (error) {
      return res.status(200).json({
        ok: true,
        mode: 'fallback',
        data: defaultPayload(),
        warning: 'KV read failed, using fallback content.'
      });
    }
  }

  if (req.method === 'PUT') {
    if (!kvConfig) {
      return res.status(503).json({
        ok: false,
        error: 'KV is not configured. Set KV_REST_API_URL and KV_REST_API_TOKEN in Vercel environment variables.'
      });
    }

    try {
      const payload = sanitizePayload(req.body);
      await kvSet(kvConfig, KV_KEY, payload);
      return res.status(200).json({ ok: true, mode: 'kv' });
    } catch (error) {
      return res.status(500).json({ ok: false, error: 'Failed to save site content.' });
    }
  }

  res.setHeader('Allow', 'GET, PUT');
  return res.status(405).json({ ok: false, error: 'Method not allowed' });
};
