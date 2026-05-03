import confetti from "canvas-confetti";

export function fireHabitConfetti(originEl: HTMLElement | null) {
  const rect = originEl?.getBoundingClientRect();
  const x = rect ? (rect.left + rect.width / 2) / window.innerWidth : 0.5;
  const y = rect ? (rect.top + rect.height / 2) / window.innerHeight : 0.5;
  void confetti({
    particleCount: 90,
    spread: 70,
    origin: { x, y },
    startVelocity: 28,
    ticks: 120,
    gravity: 1.05,
    scalar: 0.9,
    colors: ["#6366f1", "#10b981", "#f59e0b", "#3b82f6", "#ec4899"],
  });
}
