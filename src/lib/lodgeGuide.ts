export const LODGE_GUIDE_ENABLED = import.meta.env.VITE_ASK_CARLETON_ENABLED === 'true';

export const canAccessLodgeGuidePilot = (enabled: boolean, isAdmin: boolean) =>
  enabled && isAdmin;

export const cleanLodgeGuideAnswer = (answer: string) =>
  answer
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1');
