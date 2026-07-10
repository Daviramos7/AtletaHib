import { describe, expect, it } from 'vitest';
import { assembleDailyTruth } from './buildDailyTruth';
import { buildCardioTruth } from './cardioRules';
import { conservativeRecoveryFlag, splitDailyCheckin } from './checkinRules';
import { buildNutritionTruth } from './nutritionRules';
import { buildSleepTruth } from './sleepRules';
import { averageKnown, belongsToReviewWindow } from './weeklyReviewRules';

const emptyRaw = {
  daily: null, meals: [], sleep: [], cardio: [], strengthApp: [], strengthWearable: [], wearableDaily: [], checkin: null, weight: null,
};

describe('regras diárias', () => {
  it('não transforma macro ausente em zero conhecido', () => {
    const truth = buildNutritionTruth([{ kcal: 210, protein_g: null, carbs_g: null, fat_g: null, import_method: 'json' }]);
    expect(truth.kcal.value).toBe(210);
    expect(truth.proteinG.value).toBeNull();
    expect(truth.macrosComplete).toBe(false);
  });

  it('mantém cardio sem distância como ausente e kcal fora do total', () => {
    const truth = buildCardioTruth([{ duration_seconds: 1208, distance_km: null, active_kcal: 140 }]);
    expect(truth.durationSeconds).toBe(1208);
    expect(truth.distanceKm).toBeNull();
    expect(truth.sessionKcalIncludedInDailyTotals).toBe(false);
  });

  it('prioriza sono corrigido sobre wearable', () => {
    const truth = buildSleepTruth([{ duration_minutes: 443, replaces_health_connect_sleep: true, import_method: 'screenshot_json', confidence: 'high' }], [{ sleep_minutes: 300, source: 'health_connect' }]);
    expect(truth.value).toBe(443);
    expect(truth.origin).toBe('json');
  });

  it('separa manhã e fechamento sem perder notas', () => {
    const split = splitDailyCheckin({ sleep_hours: 7, steps: 8000, morning_notes: 'acordei bem', evening_notes: 'dia completo' });
    expect(split.morning.notes).toBe('acordei bem');
    expect(split.evening.notes).toBe('dia completo');
  });

  it('recomenda recuperação conservadora no contexto combinado', () => {
    expect(conservativeRecoveryFlag({ pain_level: 8, energy_score: 2 }, 300)).toBe(true);
  });

  it('mantém proveniência por campo para múltiplas fontes wearable', () => {
    const truth = assembleDailyTruth('user', '2026-07-10', {
      ...emptyRaw,
      wearableDaily: [
        { source: 'manual', steps: 12000, sleep_minutes: 440 },
        { source: 'health_connect_android_bridge', steps: 9000, active_kcal: 500 },
      ],
    });
    expect(truth.wearableTruth.steps.value).toBe(9000);
    expect(truth.wearableTruth.steps.source).toBe('health_connect_android_bridge');
    expect(truth.wearableTruth.sleep_minutes.value).toBe(440);
    expect(truth.warnings.some((warning) => warning.code === 'wearable_multiple_sources')).toBe(true);
  });

  it('não apresenta ausência como zero na verdade diária', () => {
    const truth = assembleDailyTruth('user', '2026-07-10', emptyRaw);
    expect(truth.hydration.value).toBeNull();
    expect(truth.nutrition.kcal.value).toBeNull();
    expect(truth.sleepTruth.value).toBeNull();
  });

  it('calcula média apenas com dias conhecidos e limita a janela', () => {
    expect(averageKnown([100, null, 200, undefined])).toBe(150);
    expect(belongsToReviewWindow('2026-07-10', '2026-07-04', '2026-07-10')).toBe(true);
    expect(belongsToReviewWindow('2026-07-11', '2026-07-04', '2026-07-10')).toBe(false);
  });
});
