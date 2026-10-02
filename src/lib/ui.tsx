export function fmtRand(n: number): string {
  return 'R' + Math.round(n).toLocaleString('en-ZA');
}

export function timeShort(iso: string): string {
  try {
    return new Date(iso.replace(' ', 'T') + 'Z').toLocaleTimeString('en-ZA', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export function severityOf(risk: any): 'critical' | 'warning' | 'safe' {
  const prevented = risk?.exposure?.prevented ?? 0;
  if (prevented >= 600) return 'critical';
  if (prevented >= 300) return 'warning';
  return 'safe';
}