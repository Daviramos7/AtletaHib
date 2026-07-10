export function splitDailyCheckin(checkin: any | null) {
  if (!checkin) return { morning: null, evening: null };
  const morning = hasAny(checkin, ['sleep_hours', 'energy_score', 'morning_notes', 'morning_saved_at']) ? {
    ...checkin,
    notes: checkin.morning_notes ?? checkin.notes ?? null,
    saved_at: checkin.morning_saved_at ?? checkin.updated_at ?? null,
  } : null;
  const evening = hasAny(checkin, ['steps', 'cravings_notes', 'evening_notes', 'evening_saved_at']) ? {
    ...checkin,
    notes: checkin.evening_notes ?? null,
    saved_at: checkin.evening_saved_at ?? null,
  } : null;
  return { morning, evening };
}

export function conservativeRecoveryFlag(checkin: any, sleepMinutes: number | null) {
  const highPain = Number(checkin?.pain_level) >= 7;
  const poorSleep = sleepMinutes !== null && sleepMinutes < 330;
  const lowRecovery = Number(checkin?.energy_score) <= 3 || Number(checkin?.soreness_level) >= 8;
  return highPain && poorSleep && lowRecovery;
}

function hasAny(row: any, fields: string[]) {
  return fields.some((field) => row[field] !== null && row[field] !== undefined && row[field] !== '');
}
