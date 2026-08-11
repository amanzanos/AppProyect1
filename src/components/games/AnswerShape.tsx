"use client";

/** The four Kahoot-style marks, so the screen and the phone agree at a glance. */
export default function AnswerShape({ index, size = 28 }: { index: number; size?: number }) {
  const shapes = [
    <polygon key="t" points="50,12 90,84 10,84" />,
    <polygon key="d" points="50,8 92,50 50,92 8,50" />,
    <circle key="c" cx="50" cy="50" r="40" />,
    <rect key="s" x="12" y="12" width="76" height="76" rx="6" />,
  ];
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="currentColor" aria-hidden>
      {shapes[index]}
    </svg>
  );
}
