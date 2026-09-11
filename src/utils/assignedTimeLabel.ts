export function formatAssignedTimeLabel(totalMinutes: number): string {
  if (totalMinutes === 0) return 'No sessions';
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours > 0 ? `${hours}h ` : ''}${minutes > 0 ? `${minutes}m` : ''}`.trim();
}
