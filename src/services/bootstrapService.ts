import { getProfile, upsertProfile } from './profileService';
import { getActiveTrainingPlan, createTrainingPlanFromProfile } from './trainingService';

export async function ensureUserBootstrap(userId) {
  const profile = await getProfile(userId);

  if (!profile || !profile.onboarding_completed) {
    return { profile, trainingPlan: null, needsOnboarding: true };
  }

  let trainingPlan = await getActiveTrainingPlan(userId);
  if (!trainingPlan) {
    trainingPlan = await createTrainingPlanFromProfile(userId, profile);
  }

  return { profile, trainingPlan, needsOnboarding: false };
}

export async function markOnboardingComplete(userId, profilePayload) {
  const profile = await upsertProfile(userId, { ...profilePayload, onboarding_completed: true });
  const trainingPlan = await createTrainingPlanFromProfile(userId, profile, { deactivatePrevious: true });
  return { profile, trainingPlan, needsOnboarding: false };
}
