export type MuscleGroup =
  | 'quadriceps'
  | 'posterior_de_coxa'
  | 'gluteos'
  | 'peito'
  | 'dorsais'
  | 'costas_superiores'
  | 'ombros'
  | 'biceps'
  | 'triceps'
  | 'panturrilhas'
  | 'core'
  | 'adutores'
  | 'abdutores';

export type JointLocation = 'ombro' | 'cotovelo' | 'punho' | 'lombar' | 'quadril' | 'joelho' | 'tornozelo';
export type ExerciseRole = 'main' | 'secondary' | 'accessory';

export interface ExerciseMetadata {
  primaryMuscles: MuscleGroup[];
  secondaryMuscles: MuscleGroup[];
  movementPattern: string;
  equipment: string;
  category: 'compound' | 'accessory' | 'core' | 'cardio';
  jointLocations: JointLocation[];
  estimatedActiveSecondsPerSet: number;
}

interface CatalogRule extends ExerciseMetadata {
  match: string[];
}

const CATALOG: CatalogRule[] = [
  rule(['leg press', 'agachamento', 'hack', 'afundo'], ['quadriceps', 'gluteos'], ['posterior_de_coxa'], 'agachamento', 'máquina/peso livre', 'compound', ['quadril', 'joelho', 'tornozelo'], 45),
  rule(['stiff', 'terra romeno', 'levantamento terra', 'pull-through'], ['posterior_de_coxa', 'gluteos'], ['costas_superiores'], 'hinge', 'peso livre/cabo', 'compound', ['quadril', 'lombar'], 45),
  rule(['cadeira flexora', 'mesa flexora', 'flexora'], ['posterior_de_coxa'], [], 'flexão de joelho', 'máquina', 'accessory', ['joelho'], 40),
  rule(['cadeira extensora', 'extensora'], ['quadriceps'], [], 'extensão de joelho', 'máquina', 'accessory', ['joelho'], 40),
  rule(['hip thrust', 'elevação pélvica'], ['gluteos'], ['posterior_de_coxa'], 'extensão de quadril', 'máquina/peso livre', 'compound', ['quadril', 'lombar'], 45),
  rule(['supino', 'chest press', 'flexão', 'flexao'], ['peito'], ['triceps', 'ombros'], 'empurrar horizontal', 'máquina/peso livre', 'compound', ['ombro', 'cotovelo', 'punho'], 45),
  rule(['crucifixo', 'peck deck'], ['peito'], ['ombros'], 'adução de ombro', 'máquina/cabo', 'accessory', ['ombro'], 40),
  rule(['puxada', 'pulldown', 'barra fixa', 'pullover'], ['dorsais'], ['biceps', 'costas_superiores'], 'puxar vertical', 'máquina/cabo', 'compound', ['ombro', 'cotovelo'], 45),
  rule(['remada'], ['costas_superiores', 'dorsais'], ['biceps'], 'puxar horizontal', 'máquina/peso livre', 'compound', ['ombro', 'cotovelo', 'lombar'], 45),
  rule(['desenvolvimento', 'shoulder press'], ['ombros'], ['triceps'], 'empurrar vertical', 'máquina/peso livre', 'compound', ['ombro', 'cotovelo', 'punho'], 45),
  rule(['elevação lateral', 'elevacao lateral'], ['ombros'], [], 'abdução de ombro', 'máquina/peso livre', 'accessory', ['ombro'], 40),
  rule(['rosca', 'bíceps', 'biceps'], ['biceps'], [], 'flexão de cotovelo', 'máquina/peso livre', 'accessory', ['cotovelo', 'punho'], 40),
  rule(['tríceps', 'triceps'], ['triceps'], [], 'extensão de cotovelo', 'cabo/máquina', 'accessory', ['cotovelo', 'ombro'], 40),
  rule(['panturrilha'], ['panturrilhas'], [], 'panturrilha', 'máquina/peso livre', 'accessory', ['tornozelo'], 40),
  rule(['prancha', 'abdominal', 'dead bug', 'pallof', 'core'], ['core'], [], 'core', 'livre/máquina', 'core', ['lombar'], 45),
  rule(['abdutor'], ['abdutores', 'gluteos'], [], 'abdução de quadril', 'máquina', 'accessory', ['quadril'], 40),
  rule(['adutor'], ['adutores'], [], 'adução de quadril', 'máquina', 'accessory', ['quadril'], 40),
  rule(['corrida', 'caminhada', 'bike', 'bicicleta', 'elíptico', 'eliptico', 'futebol'], ['quadriceps', 'panturrilhas'], ['posterior_de_coxa', 'gluteos'], 'cardio', 'cardio', 'cardio', ['quadril', 'joelho', 'tornozelo'], 30),
];

const FALLBACK: ExerciseMetadata = {
  primaryMuscles: [],
  secondaryMuscles: [],
  movementPattern: 'não classificado',
  equipment: 'não informado',
  category: 'accessory',
  jointLocations: [],
  estimatedActiveSecondsPerSet: 40,
};

export function getExerciseMetadata(exerciseName: unknown): ExerciseMetadata {
  const normalized = normalizeText(exerciseName);
  const found = CATALOG.find((item) => item.match.some((term) => normalized.includes(normalizeText(term))));
  if (!found) return { ...FALLBACK, primaryMuscles: [], secondaryMuscles: [], jointLocations: [] };

  return {
    primaryMuscles: [...found.primaryMuscles],
    secondaryMuscles: [...found.secondaryMuscles],
    movementPattern: found.movementPattern,
    equipment: found.equipment,
    category: found.category,
    jointLocations: [...found.jointLocations],
    estimatedActiveSecondsPerSet: found.estimatedActiveSecondsPerSet,
  };
}

export function resolveExerciseRole(exercise: { exercise_role?: unknown; role?: unknown; exercise_name?: unknown }): ExerciseRole {
  const explicit = String(exercise.exercise_role ?? exercise.role ?? '').toLowerCase();
  if (explicit === 'main' || explicit === 'secondary' || explicit === 'accessory') return explicit;

  const category = getExerciseMetadata(exercise.exercise_name).category;
  if (category === 'compound') return 'main';
  return 'accessory';
}

export function formatMuscleGroup(muscle: MuscleGroup) {
  return ({
    quadriceps: 'quadríceps',
    posterior_de_coxa: 'posterior de coxa',
    gluteos: 'glúteos',
    peito: 'peito',
    dorsais: 'dorsais',
    costas_superiores: 'costas',
    ombros: 'ombros',
    biceps: 'bíceps',
    triceps: 'tríceps',
    panturrilhas: 'panturrilhas',
    core: 'core',
    adutores: 'adutores',
    abdutores: 'abdutores',
  })[muscle];
}

function rule(
  match: string[],
  primaryMuscles: MuscleGroup[],
  secondaryMuscles: MuscleGroup[],
  movementPattern: string,
  equipment: string,
  category: ExerciseMetadata['category'],
  jointLocations: JointLocation[],
  estimatedActiveSecondsPerSet: number,
): CatalogRule {
  return { match, primaryMuscles, secondaryMuscles, movementPattern, equipment, category, jointLocations, estimatedActiveSecondsPerSet };
}

function normalizeText(value: unknown) {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}
