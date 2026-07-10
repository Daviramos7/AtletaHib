export function buildStrengthTruth(appSessions: any[] = [], wearableSessions: any[] = []) {
  return {
    app: { sessions: appSessions.length, source: 'app', includesSetsAndLoads: true },
    wearable: { sessions: wearableSessions.length, source: 'wearable', includesSetsAndLoads: false, includedInDailyTotals: false },
  };
}
