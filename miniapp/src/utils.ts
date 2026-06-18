export function hpColor(hp: number): string {
  if (hp > 60) return 'var(--hp-hi)'
  if (hp >= 30) return 'var(--hp-mid)'
  return 'var(--hp-lo)'
}
