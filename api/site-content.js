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

function parseRedisResponse(raw) {
  if (!raw || raw.length < 1) throw new Error('Empty Redis response');

  const type = raw[0];

  if (type === '+') {
    return raw.slice(1, raw.indexOf('\r\n'));
  }

  if (type === '-') {
    const msg = raw.slice(1, raw.indexOf('\r\n'));
    throw new Error('Redis error: ' + msg);
  }

  if (type === ':') {
    return Number(raw.slice(1, raw.indexOf('\r\n')));
  }

  if (type === '$') {
    const lineEnd = raw.indexOf('\r\n');
    const len = Number(raw.slice(1, lineEnd));
    if (len === -1) return null;
    const start = lineEnd + 2;
    const end = start + len;
    return raw.slice(start, end);
  }

  throw new Error('Unsupported Redis response type: ' + type);
}

async function redisCommand(config, args) {
  return new Promise((resolve, reject) => {
    const socket = tls.connect(
      {
        host: config.host,
        port: config.port,
        servername: config.host,
        rejectUnauthorized: true
      },
      () => {
        const authArgs = config.password
          ? ['AUTH', config.username || 'default', config.password]
          : null;

        const commandPayload = authArgs
          ? encodeRedisCommand(authArgs) + encodeRedisCommand(args)
          : encodeRedisCommand(args);

        socket.write(commandPayload);
      }
    );

    socket.setEncoding('utf8');
    socket.setTimeout(6000);

    let raw = '';

    socket.on('data', (chunk) => {
      raw += chunk;
    });

    socket.on('timeout', () => {
      socket.destroy();
      reject(new Error('Redis command timed out'));
    });

    socket.on('error', (error) => {
      reject(error);
    });

    socket.on('end', () => {
      try {
        if (!raw) return resolve(null);

        // If AUTH is included, first response is +OK and second is command result.
        if (config.password) {
          const firstLineEnd = raw.indexOf('\r\n');
          if (firstLineEnd === -1) throw new Error('Invalid Redis AUTH response');
          const firstLine = raw.slice(0, firstLineEnd + 2);
          const authResult = parseRedisResponse(firstLine);
          if (authResult !== 'OK') throw new Error('Redis AUTH failed');
          const rest = raw.slice(firstLineEnd + 2);
          return resolve(parseRedisResponse(rest));
        }

        resolve(parseRedisResponse(raw));
      } catch (error) {
        reject(error);
      }
    });
  });
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
