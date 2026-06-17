'use strict';

const Anthropic = require('@anthropic-ai/sdk');

const SYSTEM = `You are a senior intelligence analyst for a bank's corporate treasury division. Analyze payments industry news and synthesize it into direct, actionable intelligence for treasury bankers and fintech product teams.

Focus: RTP, FedNow, ACH, tokenized deposits, B2B stablecoins (bank-issued only — no pure crypto), correspondent banking, treasury management, regulatory developments.

Be direct and specific. Avoid generic statements. Every output must tie to competitive threat, revenue impact, or strategic opportunity for a treasury-serving bank.`;

function getClient() {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY not set');
  return new Anthropic();
}

function parseJSON(text) {
  const cleaned = text.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim();
  return JSON.parse(cleaned);
}

async function synthesizeArticle(title, content, sourceUrl, sourceName) {
  const client = getClient();
  const msg = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 900,
    system: SYSTEM,
    messages: [{
      role: 'user',
      content: `Analyze this payments industry article and return ONLY valid JSON — no markdown, no explanation.

Title: ${title}
Source: ${sourceName}
URL: ${sourceUrl}

Content excerpt:
${content.slice(0, 3500)}

Return exactly this structure:
{
  "intelligenceType": "threat | opportunity | expansion | regulatory",
  "summary": "2-3 sentence factual summary of the article",
  "businessImpact": "One paragraph stating direct competitive/revenue/strategic impact on treasury-serving banks. Be specific.",
  "technicalTakeaway": "One sentence on technical implications",
  "businessTakeaway": "One sentence on business or revenue implications",
  "treasuryTakeaway": "One sentence on corporate treasury client implications",
  "primaryTopic": "Brief topic label e.g. FedNow Adoption or Tokenized Deposits",
  "rail": "RTP | FedNow | ACH | Adjacent | Regulatory",
  "priorityBand": "high | medium | monitor",
  "tags": ["tag1", "tag2", "tag3"]
}`
    }]
  });

  return parseJSON(msg.content[0].text);
}

async function generateWeeklySummary(items) {
  const client = getClient();
  const digest = items
    .slice(0, 20)
    .map(i => `[${(i.priorityBand || 'monitor').toUpperCase()}][${i.intelligenceType || 'update'}] ${i.title}: ${(i.businessImpact || i.summary || '').slice(0, 200)}`)
    .join('\n');

  const msg = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1400,
    system: SYSTEM,
    messages: [{
      role: 'user',
      content: `Write a weekly intelligence brief for a bank's treasury team based on these developments:

${digest}

Return ONLY valid JSON:
{
  "headline": "Punchy headline capturing the week's most important theme (max 15 words)",
  "summary": "Newsletter-style brief covering: (1) the 2 most important developments this week and their direct business implications, (2) what it means for treasury product teams, (3) 3 specific action items numbered like: 1. **Action title**: explanation. Use **bold** for key terms. 4-5 paragraphs total.",
  "authorNote": "One sentence source attribution note"
}`
    }]
  });

  return parseJSON(msg.content[0].text);
}

async function generateMonthlySummary(items) {
  const client = getClient();
  const digest = items
    .slice(0, 30)
    .map(i => `[${(i.intelligenceType || 'update').toUpperCase()}] ${i.title}: ${(i.businessImpact || i.summary || '').slice(0, 150)}`)
    .join('\n');

  const msg = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1800,
    system: SYSTEM,
    messages: [{
      role: 'user',
      content: `Write a monthly strategic intelligence brief for a bank's treasury team based on these developments:

${digest}

Return ONLY valid JSON:
{
  "headline": "Strategic headline naming the month's defining theme (max 15 words)",
  "summary": "Strategic monthly brief: identify 2-3 major tensions or themes that defined the month, explain implications for treasury banking, and end with 4 prioritized action items numbered like: 1. **Priority**: explanation. Use **bold** for key terms and **Tension N:** headers. 5-7 paragraphs total.",
  "authorNote": "One sentence attribution note"
}`
    }]
  });

  return parseJSON(msg.content[0].text);
}

module.exports = { synthesizeArticle, generateWeeklySummary, generateMonthlySummary };
