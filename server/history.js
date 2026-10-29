import fs from 'node:fs';
import path from 'node:path';

import { clamp, shortId } from './utils.js';

const MAX_IMAGE_URL = 1_800_000;
const MAX_IMAGES = 4;

function cleanText(value = '', max = 3000) {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function cleanStringList(value, maxItems, maxLength) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => cleanText(item, maxLength))
    .filter(Boolean)
    .slice(0, maxItems);
}

function normalizeImage(image) {
  if (!image || typeof image !== 'object') return null;
  const url = String(image.url || '').trim();
  if (!url || url.length > MAX_IMAGE_URL) return null;
  if (!/^(https?:\/\/|data:image\/)/i.test(url)) return null;
  const width = Number(image.width);
  const height = Number(image.height);
  return {
    url,
    width: Number.isFinite(width) && width > 0 ? Math.round(width) : null,
    height: Number.isFinite(height) && height > 0 ? Math.round(height) : null,
  };
}

function normalizeImages(value) {
  if (!Array.isArray(value)) return [];
  return value.map(normalizeImage).filter(Boolean).slice(0, MAX_IMAGES);
}

function normalizeReferences(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((reference) => {
      if (!reference || typeof reference !== 'object') return null;
      const title = cleanText(reference.title, 140);
      if (!title) return null;
      return {
        id: cleanText(reference.id, 120),
        title,
        category: cleanText(reference.category, 60),
        excerpt: cleanText(reference.excerpt, 360),
        source: cleanText(reference.source, 120),
      };
    })
    .filter(Boolean)
    .slice(0, 6);
}

function normalizeLabel(value, max = 60) {
  if (typeof value === 'string') {
    const id = cleanText(value, 60);
    return { id, label: id };
  }
  if (!value || typeof value !== 'object') return { id: '', label: '' };
  return {
    id: cleanText(value.id, 60),
    label: cleanText(value.label || value.short, max),
  };
}

export function normalizeHistoryRecord(record = {}) {
  const prompt = cleanText(record.prompt, 3000);
  const original = cleanText(record.original, 800);
  if (!prompt && !original) return null;
  const createdAt = new Date(record.createdAt || Date.now());
  return {
    id: cleanText(record.id, 40) || shortId('hist'),
    createdAt: Number.isNaN(createdAt.getTime()) ? new Date().toISOString() : createdAt.toISOString(),
    original,
    prompt,
    subject: cleanText(record.subject || original || prompt, 120),
    negativePrompt: cleanText(record.negativePrompt, 1200),
    keywords: cleanStringList(record.keywords, 12, 40),
    rationale: cleanStringList(record.rationale, 8, 180),
    references: normalizeReferences(record.references),
    strength: normalizeLabel(record.strength),
    style: normalizeLabel(record.style),
    llmModel: cleanText(record.llmModel, 80),
    llmModelLabel: cleanText(record.llmModelLabel, 120),
    ratio: cleanText(record.ratio, 20) || '1:1',
    count: clamp(Number.parseInt(record.count, 10) || 1, 1, 4),
    imageModel: cleanText(record.imageModel, 80),
    imageModelLabel: cleanText(record.imageModelLabel, 120),
    imageEngine: cleanText(record.imageEngine, 40),
    warning: cleanText(record.warning, 600) || null,
    images: normalizeImages(record.images),
  };
}

export class HistoryStore {
  constructor({ filePath, limit = 10 } = {}) {
    this.filePath = filePath;
    this.limit = clamp(Number.parseInt(limit, 10) || 10, 1, 50);
    this.items = [];
  }

  init() {
    if (!this.filePath) return this;
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    if (!fs.existsSync(this.filePath)) return this;
    try {
      const payload = JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
      const entries = Array.isArray(payload) ? payload : payload?.items;
      if (!Array.isArray(entries)) return this;
      const seen = new Set();
      this.items = entries
        .map(normalizeHistoryRecord)
        .filter((item) => {
          if (!item || seen.has(item.id)) return false;
          seen.add(item.id);
          return true;
        })
        .slice(0, this.limit);
    } catch (error) {
      console.warn('[history] 生成记录读取失败，已从空记录开始：', error.message);
      this.items = [];
    }
    return this;
  }

  list() {
    return this.items;
  }

  add(record) {
    const item = normalizeHistoryRecord({
      ...record,
      id: shortId('hist'),
      createdAt: new Date().toISOString(),
    });
    if (!item) return null;
    this.items = [item, ...this.items].slice(0, this.limit);
    this.persist();
    return item;
  }

  remove(id) {
    const index = this.items.findIndex((item) => item.id === id);
    if (index < 0) return null;
    const [removed] = this.items.splice(index, 1);
    this.persist();
    return removed;
  }

  clear() {
    this.items = [];
    this.persist();
    return this.items;
  }

  persist() {
    if (!this.filePath) return;
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    const tmpPath = `${this.filePath}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify({ version: 1, items: this.items }), 'utf8');
    fs.renameSync(tmpPath, this.filePath);
  }
}
