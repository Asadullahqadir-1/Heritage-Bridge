const fs = require('fs');
const path = require('path');
const tls = require('tls');

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

function getRedisUrlConfig() {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) return null;

  try {
    const parsed = new URL(redisUrl);
    if (parsed.protocol !== 'redis:' && parsed.protocol !== 'rediss:') return null;

    return {
      host: parsed.hostname,
      port: Number(parsed.port || 6379),
      username: decodeURIComponent(parsed.username || 'default'),
      password: decodeURIComponent(parsed.password || ''),
      tls: true
    };
  } catch (error) {
    return null;
  }
}

function encodeRedisCommand(args) {
  let payload = '*' + args.length + '\r\n';
  args.forEach((arg) => {
    const strArg = String(arg);
    payload += '$' + Buffer.byteLength(strArg, 'utf8') + '\r\n' + strArg + '\r\n';
  });
  return payload;
}

function parseRedisFrame(raw, offset) {
  if (offset >= raw.length) throw new Error('INCOMPLETE');

  const type = raw[offset];
  const lineEnd = raw.indexOf('\r\n', offset);
  if (lineEnd === -1) throw new Error('INCOMPLETE');

  if (type === '+') {
    return {
      kind: 'simple',
      value: raw.slice(offset + 1, lineEnd),
      nextOffset: lineEnd + 2
    };
  }

  if (type === '-') {
    return {
      kind: 'error',
      value: raw.slice(offset + 1, lineEnd),
      nextOffset: lineEnd + 2
    };
  }

  if (type === ':') {
    return {
      kind: 'integer',
      value: Number(raw.slice(offset + 1, lineEnd)),
      nextOffset: lineEnd + 2
    };
  }

  if (type === '$') {
    const len = Number(raw.slice(offset + 1, lineEnd));
    if (Number.isNaN(len)) throw new Error('Invalid bulk length');
    if (len === -1) {
      return {
        kind: 'bulk',
        value: null,
        nextOffset: lineEnd + 2
      };
    }

    const start = lineEnd + 2;
    const end = start + len;
    if (raw.length < end + 2) throw new Error('INCOMPLETE');
    if (raw.slice(end, end + 2) !== '\r\n') throw new Error('Invalid bulk terminator');

    return {
      kind: 'bulk',
      value: raw.slice(start, end),
      nextOffset: end + 2
    };
  }

  throw new Error('Unsupported Redis response type: ' + type);
}

async function redisCommand(config, args) {
  async function runWithAuthArgs(authArgs) {
    return new Promise((resolve, reject) => {
      let settled = false;
      let raw = '';

      function safeResolve(value) {
        if (settled) return;
        settled = true;
        socket.end();
        resolve(value);
      }

      function safeReject(error) {
        if (settled) return;
        settled = true;
        socket.destroy();
        reject(error);
      }

      function tryParse() {
        try {
          let offset = 0;
          let authFrame = null;
          let commandFrame = null;

          if (authArgs) {
            authFrame = parseRedisFrame(raw, offset);
            offset = authFrame.nextOffset;
            if (authFrame.kind === 'error') {
              safeReject(new Error('Redis AUTH failed: ' + authFrame.value));
              return;
            }
          }

          commandFrame = parseRedisFrame(raw, offset);
          if (commandFrame.kind === 'error') {
            safeReject(new Error('Redis command failed: ' + commandFrame.value));
            return;
          }

          if (authFrame && authFrame.value !== 'OK') {
            safeReject(new Error('Redis AUTH failed'));
            return;
          }

          safeResolve(commandFrame.value);
        } catch (error) {
          if (error.message === 'INCOMPLETE') return;
          safeReject(error);
        }
      }

      const socket = tls.connect(
        {
          host: config.host,
          port: config.port,
          servername: config.host,
          rejectUnauthorized: true
        },
        () => {
          const commandPayload = authArgs
            ? encodeRedisCommand(authArgs) + encodeRedisCommand(args)
            : encodeRedisCommand(args);

          socket.write(commandPayload);
        }
      );

      socket.setEncoding('utf8');
      socket.setTimeout(6000);

      socket.on('data', (chunk) => {
        raw += chunk;
        tryParse();
      });

      socket.on('timeout', () => {
        safeReject(new Error('Redis command timed out'));
      });

      socket.on('error', (error) => {
        safeReject(error);
      });
    });
  }

  const authVariants = config.password
    ? [
        ['AUTH', config.username || 'default', config.password],
        ['AUTH', config.password]
      ]
    : [null];

  let lastError = null;

  for (const authArgs of authVariants) {
    try {
      return await runWithAuthArgs(authArgs);
    } catch (error) {
      lastError = error;
      const isAuthFailure = String(error && error.message || '').toLowerCase().includes('auth');
      if (!isAuthFailure) throw error;
    }
  }

  throw lastError || new Error('Redis command failed');
}

async function redisGet(config, key) {
  const value = await redisCommand(config, ['GET', key]);
  return value;
}

async function redisSet(config, key, value) {
  const serialized = JSON.stringify(value);
  await redisCommand(config, ['SET', key, serialized]);
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

  const redisConfig = getRedisUrlConfig();
  const kvConfig = getKvConfig();
  const mode = redisConfig ? 'redis-url' : (kvConfig ? 'kv' : 'fallback');

  if (req.method === 'GET') {
    if (!redisConfig && !kvConfig) {
      return res.status(200).json({
        ok: true,
        mode: 'fallback',
        data: defaultPayload()
      });
    }

    try {
      const stored = redisConfig
        ? await redisGet(redisConfig, KV_KEY)
        : await kvGet(kvConfig, KV_KEY);

      let parsed = null;
      if (typeof stored === 'string') {
        parsed = JSON.parse(stored);
      } else {
        parsed = stored;
      }

      const payload = parsed ? sanitizePayload(parsed) : defaultPayload();
      return res.status(200).json({ ok: true, mode, data: payload });
    } catch (error) {
      return res.status(200).json({
        ok: true,
        mode: 'fallback',
        data: defaultPayload(),
        warning: 'Storage read failed, using fallback content.'
      });
    }
  }

  if (req.method === 'PUT') {
    if (!redisConfig && !kvConfig) {
      return res.status(503).json({
        ok: false,
        error: 'Storage is not configured. Set REDIS_URL, or KV_REST_API_URL + KV_REST_API_TOKEN in Vercel environment variables.'
      });
    }

    try {
      const payload = sanitizePayload(req.body);
      if (redisConfig) {
        await redisSet(redisConfig, KV_KEY, payload);
      } else {
        await kvSet(kvConfig, KV_KEY, payload);
      }
      return res.status(200).json({ ok: true, mode });
    } catch (error) {
      return res.status(500).json({ ok: false, error: 'Failed to save site content.' });
    }
  }

  res.setHeader('Allow', 'GET, PUT');
  return res.status(405).json({ ok: false, error: 'Method not allowed' });
};
