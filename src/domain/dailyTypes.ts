export type DataOrigin = 'manual' | 'json' | 'wearable' | 'app' | 'derived' | 'unknown';
export type DataConfidence = 'high' | 'medium' | 'low' | 'manual_review';
export type DataState = 'present' | 'estimated' | 'missing';

export type SourcedValue<T> = {
  value: T | null;
  state: DataState;
  origin: DataOrigin;
  source: string | null;
  confidence: DataConfidence;
  includedInDailyTotals: boolean;
};

export type DailyWarning = {
  code: string;
  level: 'high' | 'medium' | 'info';
  title: string;
  message: string;
};

export type DailyTruthRaw = {
  daily: any | null;
  meals: any[];
  sleep: any[];
  cardio: any[];
  strengthApp: any[];
  strengthWearable: any[];
  wearableDaily: any[];
  checkin: any | null;
  weight: any | null;
};

export type DailyTruth = DailyTruthRaw & {
  userId: string;
  date: string;
  hydration: SourcedValue<number>;
  nutrition: {
    kcal: SourcedValue<number>;
    proteinG: SourcedValue<number>;
    carbsG: SourcedValue<number>;
    fatG: SourcedValue<number>;
    macrosComplete: boolean;
  };
  sleepTruth: SourcedValue<number>;
  cardioTruth: {
    sessions: number;
    durationSeconds: number;
    distanceKm: number | null;
    sessionKcal: number | null;
    sessionKcalIncludedInDailyTotals: false;
  };
  wearableTruth: Record<string, SourcedValue<number>>;
  checkinMorning: any | null;
  checkinEvening: any | null;
  warnings: DailyWarning[];
  data_quality_score: number;
  confidence: DataConfidence;
};
