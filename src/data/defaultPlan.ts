export const PROFILE_FORM_DEFAULTS = {
  name: '',
  height_cm: '',
  starting_weight_kg: '',
  current_weight_kg: '',
  target_weight_kg: '',
  kcal_goal: 2200,
  water_goal_ml: 2500,
  dietary_restriction: 'Nenhuma restrição informada.',
  lunch_time: '12:30',
  training_time: '18:00',
  routine_notes: '',
  objective: 'Melhorar saúde, condicionamento e consistência.',
  onboarding_completed: false,
  training_level: 'iniciante',
  main_goal: 'saude',
  weekly_strength_days: 3,
  weekly_cardio_days: 2,
  plays_football: false,
  diet_style: 'flexivel',
  wearable_provider: 'none',
  preferred_sync_mode: 'manual',
  health_platform: 'none',
};

export const PROFILE_FALLBACKS = {
  name: 'Atleta',
  height_cm: 170,
  starting_weight_kg: 80,
  current_weight_kg: 80,
  target_weight_kg: 75,
  kcal_goal: 2200,
  water_goal_ml: 2500,
  dietary_restriction: 'Nenhuma restrição informada.',
  lunch_time: '12:30',
  training_time: '18:00',
  routine_notes: 'Rotina ainda não personalizada.',
  objective: 'Melhorar saúde, condicionamento e consistência.',
  onboarding_completed: true,
  training_level: 'iniciante',
  main_goal: 'saude',
  weekly_strength_days: 3,
  weekly_cardio_days: 2,
  plays_football: false,
  diet_style: 'flexivel',
  wearable_provider: 'none',
  preferred_sync_mode: 'manual',
  health_platform: 'none',
};

export const GOAL_OPTIONS = {
  emagrecimento: 'Emagrecimento',
  massa: 'Ganho de massa',
  condicionamento: 'Condicionamento',
  futebol: 'Performance no futebol',
  saude: 'Saúde geral',
};

export const LEVEL_OPTIONS = {
  iniciante: 'Iniciante',
  intermediario: 'Intermediário',
  avancado: 'Avançado',
};

export const DIET_STYLE_OPTIONS = {
  flexivel: 'Flexível',
  alta_proteina: 'Alta proteína',
  sem_lactose: 'Sem lactose',
  vegetariana: 'Vegetariana',
  personalizada: 'Personalizada',
};

export const WEARABLE_OPTIONS = {
  none: 'Nenhum / manual',
  redmi_mi_fitness: 'Redmi Watch + Mi Fitness',
  health_connect: 'Android Health Connect',
  strava: 'Strava',
  apple_health: 'Apple Saúde / Apple Watch',
  fitbit_google: 'Fitbit / Google Health',
  samsung_health: 'Samsung Health',
  garmin: 'Garmin',
  other: 'Outro',
};

export const SYNC_MODE_OPTIONS = {
  manual: 'Manual por enquanto',
  health_connect: 'Health Connect — ponte Android',
  strava: 'Strava — atividades/corridas',
  xiaomi_export: 'Exportação Xiaomi/Mi Fitness',
  apple_health: 'Apple Saúde/HealthKit',
  other: 'Outro',
};

export const HEALTH_PLATFORM_OPTIONS = {
  none: 'Nenhuma',
  mi_fitness: 'Mi Fitness',
  health_connect: 'Health Connect',
  strava: 'Strava',
  apple_health: 'Apple Saúde',
  samsung_health: 'Samsung Health',
  garmin_connect: 'Garmin Connect',
  other: 'Outro',
};

export const MEALS = [
  { id: 'cafe', name: 'Café da manhã' },
  { id: 'lanche1', name: 'Lanche da manhã' },
  { id: 'almoco', name: 'Almoço' },
  { id: 'lanche2', name: 'Pré/Pós-treino' },
  { id: 'jantar', name: 'Jantar' },
  { id: 'extra', name: 'Extra / fora do plano' },
];

export const DEFAULT_FOODS = [
  { name: 'Frango grelhado', kcal_per_100g: 165, protein_per_100g: 31, carbs_per_100g: 0, fat_per_100g: 3.6 },
  { name: 'Ovo inteiro cozido', kcal_per_100g: 155, protein_per_100g: 13, carbs_per_100g: 1.1, fat_per_100g: 11 },
  { name: 'Arroz branco cozido', kcal_per_100g: 128, protein_per_100g: 2.5, carbs_per_100g: 28, fat_per_100g: 0.2 },
  { name: 'Feijão cozido', kcal_per_100g: 77, protein_per_100g: 4.8, carbs_per_100g: 14, fat_per_100g: 0.5 },
  { name: 'Macaxeira cozida', kcal_per_100g: 125, protein_per_100g: 1, carbs_per_100g: 30, fat_per_100g: 0.3 },
  { name: 'Batata doce cozida', kcal_per_100g: 86, protein_per_100g: 1.6, carbs_per_100g: 20, fat_per_100g: 0.1 },
  { name: 'Batata inglesa cozida', kcal_per_100g: 87, protein_per_100g: 1.9, carbs_per_100g: 20, fat_per_100g: 0.1 },
  { name: 'Cuscuz de milho cozido', kcal_per_100g: 112, protein_per_100g: 2.2, carbs_per_100g: 25, fat_per_100g: 0.7 },
  { name: 'Tapioca goma', kcal_per_100g: 346, protein_per_100g: 0.2, carbs_per_100g: 86, fat_per_100g: 0 },
  { name: 'Pão francês', kcal_per_100g: 300, protein_per_100g: 8, carbs_per_100g: 58, fat_per_100g: 3 },
  { name: 'Banana', kcal_per_100g: 89, protein_per_100g: 1.1, carbs_per_100g: 23, fat_per_100g: 0.3 },
  { name: 'Maçã', kcal_per_100g: 52, protein_per_100g: 0.3, carbs_per_100g: 14, fat_per_100g: 0.2 },
  { name: 'Mamão', kcal_per_100g: 43, protein_per_100g: 0.5, carbs_per_100g: 11, fat_per_100g: 0.3 },
  { name: 'Morango congelado', kcal_per_100g: 32, protein_per_100g: 0.7, carbs_per_100g: 7.7, fat_per_100g: 0.3 },
  { name: 'Aveia', kcal_per_100g: 394, protein_per_100g: 14, carbs_per_100g: 66, fat_per_100g: 7 },
  { name: 'Patinho moído', kcal_per_100g: 219, protein_per_100g: 27, carbs_per_100g: 0, fat_per_100g: 12 },
  { name: 'Peixe grelhado', kcal_per_100g: 128, protein_per_100g: 26, carbs_per_100g: 0, fat_per_100g: 2.7 },
  { name: 'Leite zero lactose', kcal_per_100g: 60, protein_per_100g: 3.1, carbs_per_100g: 4.7, fat_per_100g: 3 },
  { name: 'Iogurte zero lactose', kcal_per_100g: 60, protein_per_100g: 4, carbs_per_100g: 7, fat_per_100g: 1.5 },
  { name: 'Whey zero lactose', kcal_per_100g: 383, protein_per_100g: 77, carbs_per_100g: 5, fat_per_100g: 5 },
  { name: 'Whey isolado sem lactose', kcal_per_100g: 370, protein_per_100g: 85, carbs_per_100g: 2, fat_per_100g: 2 },
  { name: 'Proteína vegetal', kcal_per_100g: 390, protein_per_100g: 75, carbs_per_100g: 8, fat_per_100g: 6 },
];

export const RUN_PLAN = [
  {
    week: 1,
    title: 'Base sem pressa',
    protocol: '15 a 20min — 5min caminhada + 8 a 10x: 30s trote + 90s caminhada',
    goal: 'Criar tolerância ao impacto e achar um ritmo sustentável.',
  },
  {
    week: 2,
    title: 'Mais tempo correndo',
    protocol: '15 a 20min — 5min caminhada + 8 a 10x: 45s trote + 75s caminhada',
    goal: 'Aumentar exposição ao trote sem precisar correr rápido.',
  },
  {
    week: 3,
    title: '1 para 1',
    protocol: '15 a 20min — 5min caminhada + 10x: 1min trote + 1min caminhada',
    goal: 'Melhorar respiração e controle do ritmo.',
  },
  {
    week: 4,
    title: 'Blocos maiores',
    protocol: '15 a 20min — 5min caminhada + 6x: 2min trote + 1min caminhada',
    goal: 'Sustentar mais tempo correndo.',
  },
  {
    week: 5,
    title: 'Quase contínuo',
    protocol: '15 a 20min — 5min caminhada + 5x: 3min trote + 1min caminhada',
    goal: 'Preparar o corpo para correr 1 km direto.',
  },
  {
    week: 6,
    title: 'Teste 1 km',
    protocol: 'Aquecimento + 1 km contínuo em ritmo leve + caminhada final',
    goal: 'Terminar inteiro, sem dor e sem buscar recorde.',
  },
];

const strengthLibrary = {
  A: [
    { position: 1, exercise_name: 'Leg press 45°', sets: '3', reps: '10-12', rest_seconds: 90, exercise_role: 'main', notes: 'Amplitude confortável e técnica limpa.' },
    { position: 2, exercise_name: 'Supino máquina ou halteres', sets: '3', reps: '8-12', rest_seconds: 90, exercise_role: 'main', notes: 'Carga moderada.' },
    { position: 3, exercise_name: 'Puxada na frente', sets: '3', reps: '10-12', rest_seconds: 90, exercise_role: 'main', notes: 'Controlar a descida.' },
    { position: 4, exercise_name: 'Remada baixa', sets: '3', reps: '10-12', rest_seconds: 90, exercise_role: 'secondary', notes: 'Lombar neutra.' },
    { position: 5, exercise_name: 'Prancha', sets: '3', reps: '20-45s', rest_seconds: 60, exercise_role: 'accessory', notes: 'Core firme.' },
  ],
  B: [
    { position: 1, exercise_name: 'Cadeira flexora', sets: '3', reps: '10-12', rest_seconds: 75, exercise_role: 'main', notes: 'Posterior de coxa controlado.' },
    { position: 2, exercise_name: 'Desenvolvimento máquina/halteres', sets: '3', reps: '10-12', rest_seconds: 90, exercise_role: 'main', notes: 'Sem arquear lombar.' },
    { position: 3, exercise_name: 'Cadeira extensora', sets: '3', reps: '12-15', rest_seconds: 75, exercise_role: 'secondary', notes: 'Movimento controlado.' },
    { position: 4, exercise_name: 'Rosca direta ou alternada', sets: '2-3', reps: '10-12', rest_seconds: 60, exercise_role: 'accessory', notes: 'Sem roubar.' },
    { position: 5, exercise_name: 'Tríceps corda', sets: '2-3', reps: '10-12', rest_seconds: 60, exercise_role: 'accessory', notes: 'Cotovelos estáveis.' },
  ],
  C: [
    { position: 1, exercise_name: 'Agachamento goblet ou smith', sets: '3', reps: '8-10', rest_seconds: 90, exercise_role: 'main', notes: 'Escolher amplitude segura.' },
    { position: 2, exercise_name: 'Mesa flexora', sets: '3', reps: '10-12', rest_seconds: 75, exercise_role: 'main', notes: 'Controle total.' },
    { position: 3, exercise_name: 'Puxada triângulo', sets: '3', reps: '10-12', rest_seconds: 90, exercise_role: 'main', notes: 'Pegada neutra.' },
    { position: 4, exercise_name: 'Supino inclinado máquina/halteres', sets: '3', reps: '10-12', rest_seconds: 90, exercise_role: 'secondary', notes: 'Controle na descida.' },
    { position: 5, exercise_name: 'Cadeira abdutora', sets: '2-3', reps: '12-15', rest_seconds: 60, exercise_role: 'accessory', notes: 'Estabilidade de quadril.' },
  ],
};

const fourDayStrengthLibrary = {
  A: [
    { position: 1, exercise_name: 'Supino máquina ou halteres', sets: '3', reps: '8-12', rest_seconds: 90, exercise_role: 'main', notes: 'Carga moderada e execução limpa.' },
    { position: 2, exercise_name: 'Puxada na frente', sets: '3', reps: '10-12', rest_seconds: 90, exercise_role: 'main', notes: 'Controlar a descida.' },
    { position: 3, exercise_name: 'Remada baixa', sets: '3', reps: '10-12', rest_seconds: 90, exercise_role: 'main', notes: 'Lombar neutra.' },
    { position: 4, exercise_name: 'Desenvolvimento máquina/halteres', sets: '2', reps: '10-12', rest_seconds: 75, exercise_role: 'secondary', notes: 'Sem arquear a lombar.' },
    { position: 5, exercise_name: 'Tríceps corda', sets: '2', reps: '10-12', rest_seconds: 60, exercise_role: 'accessory', notes: 'Cotovelos estáveis.' },
  ],
  B: [
    { position: 1, exercise_name: 'Leg press 45°', sets: '3', reps: '10-12', rest_seconds: 90, exercise_role: 'main', notes: 'Amplitude confortável e técnica limpa.' },
    { position: 2, exercise_name: 'Cadeira flexora', sets: '3', reps: '10-12', rest_seconds: 75, exercise_role: 'main', notes: 'Posterior de coxa controlado.' },
    { position: 3, exercise_name: 'Cadeira extensora', sets: '2', reps: '12-15', rest_seconds: 75, exercise_role: 'secondary', notes: 'Movimento controlado.' },
    { position: 4, exercise_name: 'Panturrilha', sets: '3', reps: '12-15', rest_seconds: 60, exercise_role: 'accessory', notes: 'Movimento completo.' },
    { position: 5, exercise_name: 'Prancha', sets: '2', reps: '20-45s', rest_seconds: 60, exercise_role: 'accessory', notes: 'Core firme.' },
  ],
  C: [
    { position: 1, exercise_name: 'Supino inclinado máquina/halteres', sets: '3', reps: '10-12', rest_seconds: 90, exercise_role: 'main', notes: 'Controle na descida.' },
    { position: 2, exercise_name: 'Puxada triângulo', sets: '3', reps: '10-12', rest_seconds: 90, exercise_role: 'main', notes: 'Pegada neutra.' },
    { position: 3, exercise_name: 'Remada baixa', sets: '2', reps: '10-12', rest_seconds: 75, exercise_role: 'secondary', notes: 'Lombar neutra e movimento controlado.' },
    { position: 4, exercise_name: 'Elevação lateral', sets: '2', reps: '12-15', rest_seconds: 60, exercise_role: 'accessory', notes: 'Sem impulso.' },
    { position: 5, exercise_name: 'Rosca direta ou alternada', sets: '2', reps: '10-12', rest_seconds: 60, exercise_role: 'accessory', notes: 'Sem roubar.' },
  ],
  D: [
    { position: 1, exercise_name: 'Agachamento goblet ou smith', sets: '3', reps: '8-10', rest_seconds: 90, exercise_role: 'main', notes: 'Escolher amplitude segura.' },
    { position: 2, exercise_name: 'Mesa flexora', sets: '3', reps: '10-12', rest_seconds: 75, exercise_role: 'main', notes: 'Controle total.' },
    { position: 3, exercise_name: 'Stiff com halteres', sets: '2', reps: '8-10', rest_seconds: 90, exercise_role: 'secondary', notes: 'Coluna neutra e carga controlada.' },
    { position: 4, exercise_name: 'Cadeira abdutora', sets: '2', reps: '12-15', rest_seconds: 60, exercise_role: 'accessory', notes: 'Estabilidade de quadril.' },
    { position: 5, exercise_name: 'Panturrilha', sets: '2', reps: '12-15', rest_seconds: 60, exercise_role: 'accessory', notes: 'Movimento completo.' },
  ],
};

function objectiveText(profile) {
  const goal = GOAL_OPTIONS[profile?.main_goal] ?? 'Saúde geral';
  const level = LEVEL_OPTIONS[profile?.training_level] ?? 'Iniciante';
  return `${goal} · nível ${level} · ${profile?.weekly_strength_days ?? 3}x força · ${profile?.weekly_cardio_days ?? 2}x cardio por semana.`;
}

function cardioNote(profile) {
  const goal = profile?.main_goal;
  if (goal === 'futebol') return 'Cardio com foco em corrida/caminhada, aceleração curta e mudança de direção quando o corpo já estiver adaptado.';
  if (goal === 'condicionamento') return 'Cardio curto e progressivo para melhorar fôlego sem passar de 20 minutos.';
  return 'Cardio leve ou moderado, curto, para saúde e aderência sem exagerar no impacto.';
}

export function buildTrainingPlanFromProfile(profile = PROFILE_FALLBACKS) {
  const strengthDays = Number(profile.weekly_strength_days ?? 3);
  const cardioDays = Number(profile.weekly_cardio_days ?? 2);
  const playsFootball = Boolean(profile.plays_football);

  const plan = {
    name: 'Plano personalizado',
    objective: objectiveText(profile),
    days: [],
  };

  const addStrengthDay = (weekday, letter, title, type = 'forca', library = strengthLibrary) => {
    const exercises = library[letter].map((exercise, idx) => ({ ...exercise, position: idx + 1 }));
    if (type.includes('corrida')) {
      exercises.push({ position: exercises.length + 1, exercise_name: 'Cardio pós-treino', sets: '1', reps: '10-15min', rest_seconds: 0, notes: cardioNote(profile) });
    }
    const hasCardio = type.includes('corrida') || type.includes('z2');
    plan.days.push({
      weekday,
      title,
      type,
      day_kind: hasCardio ? 'strength_cardio' : 'strength',
      cardio_required: hasCardio,
      cardio_options: hasCardio ? [{ label: 'Cardio pós-treino', description: cardioNote(profile) }] : [],
      notes: `Treino gerado pelo perfil do usuário. Horário preferencial: ${String(profile.training_time ?? '18:00').slice(0, 5)}. Ajuste cargas pelo registro de força.`,
      exercises,
    });
  };

  if (strengthDays <= 2) {
    addStrengthDay(1, 'A', 'Força A — Full body', cardioDays >= 2 ? 'forca_corrida' : 'forca');
    addStrengthDay(4, 'B', 'Força B — Full body');
  } else if (strengthDays === 3) {
    addStrengthDay(1, 'A', 'Força A — Full body', cardioDays >= 3 ? 'forca_corrida' : 'forca');
    addStrengthDay(3, 'B', 'Força B — Full body');
    addStrengthDay(5, 'C', 'Força C — Full body', cardioDays >= 2 ? 'forca_z2' : 'forca');
  } else {
    addStrengthDay(1, 'A', 'Superior A', cardioDays >= 1 ? 'forca_corrida' : 'forca', fourDayStrengthLibrary);
    addStrengthDay(2, 'B', 'Inferior A', cardioDays >= 3 ? 'forca_z2' : 'forca', fourDayStrengthLibrary);
    addStrengthDay(4, 'C', 'Superior B', cardioDays >= 4 ? 'forca_z2' : 'forca', fourDayStrengthLibrary);
    addStrengthDay(5, 'D', 'Inferior B', cardioDays >= 2 ? 'forca_z2' : 'forca', fourDayStrengthLibrary);
  }

  if (strengthDays < 4 && cardioDays >= 1 && !plan.days.some((day) => day.weekday === 3 && day.type.includes('corrida'))) {
    plan.days.push({
      weekday: 3,
      title: 'Cardio principal',
      type: 'corrida',
      day_kind: 'cardio',
      cardio_required: true,
      cardio_options: [{ label: 'Corrida/caminhada progressiva', description: '15-20min · Use a aba 1 km como referência.' }],
      notes: cardioNote(profile),
      exercises: [
        { position: 1, exercise_name: 'Corrida/caminhada progressiva', sets: '1', reps: '15-20min', rest_seconds: 0, notes: 'Use a aba 1 km como referência de progressão.' },
        { position: 2, exercise_name: 'Mobilidade leve', sets: '1', reps: '5min', rest_seconds: 0, notes: 'Tornozelo, quadril e panturrilha sem forçar dor.' },
      ],
    });
  }

  if (strengthDays < 4 && playsFootball) {
    plan.days.push({
      weekday: 6,
      title: 'Futebol ou cardio leve',
      type: 'futebol',
      day_kind: 'cardio',
      cardio_required: true,
      cardio_options: [
        { label: 'Futebol recreativo', description: 'até 20min recomendados · Aqueça antes.' },
        { label: 'Alternativa: caminhada/trote leve', description: '15-20min · Sem tiro forte se estiver cansado.' },
      ],
      notes: 'Se jogar bola, conta como cardio. Não faça cardio extra no mesmo dia e mantenha o plano do app limitado a 20 min.',
      exercises: [
        { position: 1, exercise_name: 'Futebol recreativo', sets: '1', reps: 'até 20min recomendados', rest_seconds: 0, notes: 'Aquecimento de 8-10min antes de entrar forte.' },
        { position: 2, exercise_name: 'Alternativa: caminhada/trote leve', sets: '1', reps: '15-20min', rest_seconds: 0, notes: 'Sem tiro forte se estiver cansado.' },
      ],
    });
  } else if (strengthDays < 4 && cardioDays >= 2 && !plan.days.some((day) => day.weekday === 6)) {
    plan.days.push({
      weekday: 6,
      title: 'Cardio leve opcional',
      type: 'cardio_leve',
      day_kind: 'cardio',
      cardio_required: true,
      cardio_options: [{ label: 'Caminhada, bike ou elíptico', description: '15-20min · Ritmo em que ainda dá para conversar.' }],
      notes: 'Sessão leve para aumentar gasto e consistência sem atrapalhar recuperação.',
      exercises: [
        { position: 1, exercise_name: 'Caminhada, bike ou elíptico', sets: '1', reps: '15-20min', rest_seconds: 0, notes: 'Ritmo em que ainda dá para conversar.' },
      ],
    });
  }

  if (strengthDays >= 4) {
    plan.days.push({
      weekday: 3,
      title: 'Descanso entre blocos',
      type: 'descanso',
      day_kind: 'rest',
      cardio_required: false,
      cardio_options: [],
      notes: 'Quarta-feira reservada para recuperação. Caminhada leve é opcional e não precisa virar treino.',
      exercises: [],
    });
    plan.days.push({
      weekday: 6,
      title: 'Dia livre',
      type: 'descanso',
      day_kind: 'rest',
      cardio_required: false,
      cardio_options: [],
      notes: 'Sábado livre. Futebol ou lazer são opcionais e devem ser registrados somente se realmente acontecerem.',
      exercises: [],
    });
  }

  plan.days.push({
    weekday: 0,
    title: 'Descanso e planejamento',
    type: 'descanso',
    day_kind: 'rest',
    cardio_required: false,
    cardio_options: [],
    notes: 'Recuperar, revisar a semana e organizar refeições. Descanso também faz parte do resultado.',
    exercises: [
      { position: 1, exercise_name: 'Revisão semanal', sets: '1', reps: '10min', rest_seconds: 0, notes: 'Conferir sono, água, peso, treinos e alimentação.' },
    ],
  });

  plan.days = [...new Map(plan.days.map((day) => [day.weekday, day])).values()].sort((a, b) => a.weekday - b.weekday);
  return plan;
}
