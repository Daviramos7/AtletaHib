import { describe, expect, it } from 'vitest';
import { getExerciseMetadata, resolveExerciseRole } from './exerciseCatalog';

describe('catálogo e prioridade dos exercícios', () => {
  it('não classifica Stiff ou Supino Inclinado por posição', () => {
    expect(resolveExerciseRole({ exercise_name: 'Stiff com halteres', exercise_role: 'secondary', position: 4 } as any)).toBe('secondary');
    expect(resolveExerciseRole({ exercise_name: 'Supino inclinado máquina', exercise_role: 'main', position: 5 } as any)).toBe('main');
  });

  it('usa fallback conservador para plano antigo sem role', () => {
    expect(resolveExerciseRole({ exercise_name: 'Supino máquina' })).toBe('main');
    expect(resolveExerciseRole({ exercise_name: 'Rosca direta' })).toBe('accessory');
  });

  it('diferencia cadeira abdutora de cadeira adutora', () => {
    expect(getExerciseMetadata('Cadeira abdutora').primaryMuscles).toEqual(['abdutores', 'gluteos']);
    expect(getExerciseMetadata('Cadeira adutora').primaryMuscles).toEqual(['adutores']);
  });
});
