// Aggregates pre-stored news sentiment scores.
// Guidance-related headlines are weighted 2x (they matter more than raw earnings beats).

function calculate(newsItems) {
  if (!newsItems || newsItems.length === 0) {
    return { score: 0, comparative: 0, label: 'neutral', headlinesAnalyzed: 0 };
  }

  let weightedScoreSum = 0;
  let weightedComparativeSum = 0;
  let totalWeight = 0;

  for (const item of newsItems) {
    const weight = item.isGuidanceRelated ? 2 : 1;
    weightedScoreSum += (item.sentiment?.score || 0) * weight;
    weightedComparativeSum += (item.sentiment?.comparative || 0) * weight;
    totalWeight += weight;
  }

  const comparative = totalWeight > 0 ? weightedComparativeSum / totalWeight : 0;

  let label;
  if (comparative > 0.5) label = 'positive';
  else if (comparative < -0.5) label = 'negative';
  else label = 'neutral';

  return {
    score: parseFloat((weightedScoreSum / totalWeight).toFixed(3)),
    comparative: parseFloat(comparative.toFixed(3)),
    label,
    headlinesAnalyzed: newsItems.length,
  };
}

module.exports = { calculate };
