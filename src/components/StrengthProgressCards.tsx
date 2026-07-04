import { buildExerciseProgress, buildWorkoutProgressSummary } from '../utils/strengthProgression';

export function ExerciseProgressMini(props: any) {
  const { exerciseName, strengthSets = [] } = props;
  const progress = buildExerciseProgress(exerciseName, strengthSets);

  if (!progress.hasHistory) {
    return (
      <div className="exercise-progress-mini-v34 empty">
        <span>Sem histórico ainda</span>
        <strong>{progress.suggestion}</strong>
      </div>
    );
  }

  const best = progress.lastSession.bestSet;

  return (
    <div className="exercise-progress-mini-v34">
      <div>
        <span>Última vez</span>
        <strong>{Number(best?.load_kg || 0)} kg · {Number(best?.reps || 0)} reps · RPE {progress.lastSession.avgRpe || '--'}</strong>
      </div>
      <div>
        <span>Sugestão</span>
        <strong>{progress.suggestion}</strong>
      </div>
      <div className="exercise-progress-stats-v34">
        <small>{progress.trendLabel}</small>
        <small>Melhor carga: {progress.bestLoad} kg</small>
        <small>Melhor volume: {progress.bestVolume} kg</small>
      </div>
    </div>
  );
}

export function WorkoutProgressSummary(props: any) {
  const { currentRows = [], strengthSets = [] } = props;
  const summary = buildWorkoutProgressSummary(currentRows, strengthSets);

  return (
    <section className="simple-panel workout-progress-summary-v34">
      <div>
        <p className="eyebrow">Performance</p>
        <h3>{summary.currentVolume} kg</h3>
        <span>Volume atual · {summary.diffLabel}</span>
      </div>

      <div className="progress-summary-grid-v34">
        <div>
          <span>Exercícios feitos</span>
          <strong>{summary.completedExercises}/{summary.totalExercises}</strong>
        </div>
        <div>
          <span>Último treino</span>
          <strong>{summary.lastWorkoutVolume || '--'} kg</strong>
        </div>
      </div>
    </section>
  );
}
