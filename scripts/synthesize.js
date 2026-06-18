'use strict';

const Anthropic = require('@anthropic-ai/sdk');

const SYSTEM = `You are a competitive intelligence analyst specializing in B2B and B2C instant payments.

Primary focus: US market — RTP (Real-Time Payments), FedNow Service, Visa Direct, Mastercard Send, stablecoins.
Secondary focus: Global B2B/B2C payments developments.

Your task: Group news into concise, actionable topic briefs (2-3 sentences each).
Each brief should clearly state:
1. What changed/happened
2. Why it matters (competitive threat, opportunity, or market shift)
3. Which rail/segment it affects

Stay factual. Only synthesize what the articles state. Be specific about US vs. global implications.`;

function getClient() {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY not set');
  return new Anthropic();
}

function parseJSON(text) {
  const cleaned = text.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim();
  try { return JSON.parse(cleaned); } catch (e) {}
  // Fall back to extracting the first {...} block
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start !== -1 && end !== -1) return JSON.parse(cleaned.slice(start, end + 1));
  throw new Error('No valid JSON found in response');
}

// Classify article into a topic group based on keywords
function classifyTopic(title, content) {
  const text = `${title} ${content}`.toLowerCase();

  if (text.includes('rtp') || text.includes('real-time payment') || text.includes('real time payment')) return 'RTP';
  if (text.includes('fednow') || text.includes('fed now')) return 'FedNow';
  if (text.includes('visa direct') || text.includes('mastercard send') || text.includes('ach')) return 'Traditional Rails';
  if (text.includes('stablecoin') || text.includes('cbdc') || text.includes('blockchain')) return 'Digital Assets';
  if (text.includes('cross-border') || text.includes('cross border') || text.includes('international')) return 'Global Payments';
  if (text.includes('regulation') || text.includes('compliance') || text.includes('regulator')) return 'Regulatory';

  return 'Market Developments';
}

async function generateTopicBriefs(items, dateStr) {
  const client = getClient();

  // Group articles by topic
  const grouped = {};
  for (const item of items) {
    const topic = classifyTopic(item.title, item.rawContent || '');
    if (!grouped[topic]) grouped[topic] = [];
    grouped[topic].push(item);
  }

  // Generate a brief for each topic group
  const briefs = {};
  for (const [topic, articles] of Object.entries(grouped)) {
    const digest = articles
      .slice(0, 5) // Max 5 articles per topic
      .map(a => `- "${a.title}" (${a.sourceName}): ${(a.rawContent || '').slice(0, 200)}`)
      .join('\n');

    try {
      const msg = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 400,
        system: SYSTEM,
        messages: [{
          role: 'user',
          content: `Synthesize these ${topic} payment articles from ${dateStr} into ONE concise brief (2-3 sentences max).
Focus: What changed, why it matters, and implications for B2B/B2C payments.
Stay factual.

Articles:
${digest}

Return ONLY the 2-3 sentence brief. No JSON, no labels, just the text.`
        }]
      });

      briefs[topic] = {
        brief: msg.content[0].text.trim(),
        sourceLinks: articles.map(a => ({
          name: a.sourceName,
          title: a.title,
          url: a.sourceUrl,
          publishedAt: a.publishedAt
        }))
      };
    } catch (err) {
      console.warn(`  Failed to synthesize ${topic}: ${err.message}`);
    }
  }

  return briefs;
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

async function generateDailySummary(items, dateStr) {
  const client = getClient();
  const digest = items
    .slice(0, 15)
    .map(i => `[${i.rail || 'Payments'}] ${i.title} (${i.sourceName}): ${(i.businessImpact || i.summary || '').slice(0, 200)}`)
    .join('\n');

  const msg = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1000,
    system: SYSTEM,
    messages: [{
      role: 'user',
      content: `Write a daily intelligence brief for a bank's treasury team based on these payment industry articles published on ${dateStr}:

${digest}

Return ONLY valid JSON:
{
  "headline": "Punchy headline capturing the most important development (max 15 words)",
  "summary": "3-4 paragraph daily brief. Lead with the most significant development and its direct business implications. Use **bold** for key terms and figures. Cover implications for treasury product teams. End with one forward-looking implication."
}`
    }]
  });

  return parseJSON(msg.content[0].text);
}

async function synthesizeArticle(title, rawContent, sourceUrl, sourceName) {
  const client = getClient();

  const msg = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 600,
    system: SYSTEM,
    messages: [{
      role: 'user',
      content: `Analyze this payment industry article and return ONLY valid JSON.

Title: ${title}
Source: ${sourceName}
Content: ${(rawContent || '').slice(0, 800)}

Return ONLY valid JSON with these exact fields:
{
  "summary": "2-3 sentence factual summary of what happened",
  "intelligenceType": "one of: product_launch | partnership | regulatory | market_data | technology | competitive | general",
  "businessImpact": "1 sentence on direct business impact",
  "technicalTakeaway": "1 sentence technical implication",
  "businessTakeaway": "1 sentence business/commercial implication",
  "treasuryTakeaway": "1 sentence implication for bank treasury teams",
  "primaryTopic": "one of: RTP | FedNow | Visa Direct | Mastercard Send | ACH | Stablecoins | CBDC | Cross-Border | Regulatory | Market",
  "rail": "one of: RTP | FedNow | Traditional Rails | Digital Assets | Global Payments | Adjacent",
  "tags": ["2-4 relevant keyword strings"],
  "priorityBand": "one of: high | medium | monitor"
}`
    }]
  });

  return parseJSON(msg.content[0].text);
}

module.exports = { synthesizeArticle, generateWeeklySummary, generateMonthlySummary, generateTopicBriefs };
