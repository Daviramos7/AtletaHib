import { buildExerciseProgress, buildWorkoutProgressSummary } from '../utils/strengthProgression';
import { formatSetExecution, isDurationExercise } from '../domain/exerciseTracking';

export function ExerciseProgressMini(props: any) {
  const { exerciseName, strengthSets = [], exercise } = props;
  const progress = buildExerciseProgress(exerciseName, strengthSets, exercise);

  if (!progress.hasHistory) {
    return (
      <div className="exercise-progress-mini-v34 empty">
        <span>Primeiro registro</span>
        <strong>{progress.suggestion}</strong>
      </div>
    );
  }

  const best = progress.lastSession.bestSet;

  return (
    <div className="exercise-progress-mini-v34">
      <div>
        <span>Última vez</span>
        <strong>{formatSetExecution(best)} · RPE {progress.lastSession.avgRpe ?? '--'}</strong>
      </div>
      <div>
        <span>Sugestão</span>
        <strong>{progress.suggestion}</strong>
      </div>
      <details className="exercise-progress-stats-v34">
        <summary>Histórico do exercício</summary>
        <small>{progress.trendLabel}</small>
        {!isDurationExercise(exercise ?? best) && <><small>Melhor carga: {progress.bestLoad} kg</small><small>Melhor volume: {progress.bestVolume} kg</small></>}
      </details>
    </div>
  );
}

export function WorkoutProgressSummary(props: any) {
  const { currentRows = [], strengthSets = [], currentSession = null } = props;
  const summary = buildWorkoutProgressSummary(currentRows, strengthSets, currentSession);

  return (
    <section className="simple-panel workout-progress-summary-v34">
      <div>
        <p className="eyebrow">Volume realizado</p>
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
