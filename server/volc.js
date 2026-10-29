import crypto from 'node:crypto';

const ALGORITHM = 'HMAC-SHA256';

function sha256Hex(value) {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}

function hmac(key, value) {
  return crypto.createHmac('sha256', key).update(value, 'utf8').digest();
}

function encodeRfc3986(value) {
  return encodeURIComponent(String(value)).replace(
    /[!'()*]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

function amzDate(date) {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

/**
 * 火山引擎 V4 签名（智能视觉 / 即梦 AI 使用）。
 * 参考 volcengine 的 HMAC-SHA256 签名流程；不依赖官方 SDK。
 */
export function signVolcRequest({
  method = 'POST',
  pathname = '/',
  query = {},
  headers = {},
  body = '',
  accessKey,
  secretKey,
  region = 'cn-north-1',
  service = 'cv',
  now = new Date(),
}) {
  if (!accessKey || !secretKey) throw new Error('缺少火山引擎 Access Key / Secret Key');

  const xDate = amzDate(now);
  const dateStamp = xDate.slice(0, 8);
  const payloadHash = sha256Hex(body);
  const contentType = headers['content-type'] || headers['Content-Type'] || 'application/json';
  const host = headers.host || headers.Host;
  if (!host) throw new Error('火山引擎签名缺少 host');

  const normalized = {};
  for (const [key, value] of Object.entries(headers)) {
    normalized[key.toLowerCase()] = String(value).trim();
  }
  normalized.host = host;
  normalized['content-type'] = contentType;
  normalized['x-content-sha256'] = payloadHash;
  normalized['x-date'] = xDate;

  const signedHeaderNames = ['content-type', 'host', 'x-content-sha256', 'x-date'];
  const canonicalHeaders = signedHeaderNames
    .map((name) => `${name}:${normalized[name]}\n`)
    .join('');
  const signedHeaders = signedHeaderNames.join(';');
  const canonicalQuery = Object.keys(query)
    .sort()
    .map((key) => `${encodeRfc3986(key)}=${encodeRfc3986(query[key])}`)
    .join('&');
  const canonicalRequest = [
    method.toUpperCase(),
    pathname || '/',
    canonicalQuery,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n');

  const credentialScope = `${dateStamp}/${region}/${service}/request`;
  const stringToSign = [
    ALGORITHM,
    xDate,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join('\n');

  const kDate = hmac(secretKey, dateStamp);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, service);
  const kSigning = hmac(kService, 'request');
  const signature = crypto.createHmac('sha256', kSigning).update(stringToSign, 'utf8').digest('hex');

  return {
    'Content-Type': contentType,
    'X-Date': xDate,
    'X-Content-Sha256': payloadHash,
    Authorization: `${ALGORITHM} Credential=${accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
  };
}
