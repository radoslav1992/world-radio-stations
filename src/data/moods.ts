// Mood / activity collections. Each maps to a Radio Browser tag and powers a
// curated landing page (/moods/<slug>) plus the cards on /moods.

export interface Mood {
  slug: string;
  /** Short label for cards and nav. */
  title: string;
  /** Page H1, e.g. "Focus radio". */
  heading: string;
  /** Radio Browser tag used to load stations across countries. */
  tag: string;
  emoji: string;
  /** One-line description for the card. */
  blurb: string;
  /** Longer intro paragraph for the mood page. */
  intro: string;
}

export const MOODS: Mood[] = [
  {
    slug: 'focus',
    title: 'Focus',
    heading: 'Focus radio',
    tag: 'ambient',
    emoji: '🎯',
    blurb: 'Calm, low-distraction stations for deep work and study.',
    intro: 'Ambient and atmospheric stations to help you concentrate — minimal vocals, steady textures and nothing jarring. Perfect for deep work, studying or reading.',
  },
  {
    slug: 'sleep',
    title: 'Sleep',
    heading: 'Sleep & relaxation radio',
    tag: 'relax',
    emoji: '🌙',
    blurb: 'Soft, soothing streams to help you wind down and drift off.',
    intro: 'Gentle, relaxing stations to ease you toward sleep. Pair it with the player’s sleep timer to fade out automatically after you’ve dozed off.',
  },
  {
    slug: 'workout',
    title: 'Workout',
    heading: 'Workout radio',
    tag: 'dance',
    emoji: '💪',
    blurb: 'High-energy beats to power your training.',
    intro: 'Up-tempo dance and electronic stations to keep your pace up. Great for the gym, a run or any session that needs momentum.',
  },
  {
    slug: 'coding',
    title: 'Coding',
    heading: 'Coding & lo-fi radio',
    tag: 'lofi',
    emoji: '💻',
    blurb: 'Steady lo-fi and electronic for getting in the zone.',
    intro: 'Lo-fi beats and mellow electronic — a relaxed backdrop that keeps you in flow without demanding attention. A developer favourite for long sessions.',
  },
  {
    slug: 'jazz',
    title: 'Jazz & Soul',
    heading: 'Jazz & soul radio',
    tag: 'jazz',
    emoji: '🎷',
    blurb: 'Smooth jazz, soul and standards for any hour.',
    intro: 'Jazz stations from around the world — from classic standards and bebop to smooth and modern jazz. Ideal for a slow morning or a late evening.',
  },
  {
    slug: 'chill',
    title: 'Chill',
    heading: 'Chillout radio',
    tag: 'chillout',
    emoji: '🛋️',
    blurb: 'Laid-back sounds to unwind to.',
    intro: 'Downtempo and chillout stations for switching off. Easy listening that fits a quiet afternoon, a dinner at home or simply doing nothing.',
  },
];

export function getMood(slug: string): Mood | undefined {
  return MOODS.find((m) => m.slug === slug);
}
