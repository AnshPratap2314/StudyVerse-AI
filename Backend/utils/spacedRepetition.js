function calculateReview(card, rating, now = new Date()) {
  const value = String(rating || "").toLowerCase();
  if (!["again", "hard", "good", "easy"].includes(value)) throw new Error("Rating must be Again, Hard, Good, or Easy.");
  let interval = Number(card.interval || 0);
  let ease = Number(card.easeFactor || 2.5);
  let difficulty = card.difficulty || "medium";
  if (value === "again") { interval = 0; ease = Math.max(1.3, ease - 0.2); difficulty = "hard"; }
  if (value === "hard") { interval = Math.max(1, Math.round(Math.max(1, interval) * 1.2)); ease = Math.max(1.3, ease - 0.15); difficulty = "hard"; }
  if (value === "good") { interval = interval <= 0 ? 1 : Math.max(2, Math.round(interval * ease)); ease = Math.min(3.0, ease + 0.05); difficulty = "medium"; }
  if (value === "easy") { interval = interval <= 0 ? 3 : Math.max(3, Math.round(interval * ease * 1.3)); ease = Math.min(3.2, ease + 0.15); difficulty = "easy"; }
  const next = new Date(now); next.setDate(next.getDate() + interval);
  const score = { again: 25, hard: 55, good: 80, easy: 100 }[value];
  return { reviewCount: Number(card.reviewCount || 0) + 1, lastReviewedAt: now, nextReviewAt: next, interval, easeFactor: Number(ease.toFixed(2)), difficulty, lastRating: value[0].toUpperCase() + value.slice(1), lastReviewScore: score };
}
module.exports = { calculateReview };
