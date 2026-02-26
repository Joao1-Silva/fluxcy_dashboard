const INTRO_SEEN_KEY = 'fluxcy_intro_seen';

const hasWindow = (): boolean => typeof window !== 'undefined';

export const hasSeenIntro = (): boolean => {
  if (!hasWindow()) {
    return false;
  }

  return window.sessionStorage.getItem(INTRO_SEEN_KEY) === '1';
};

export const markIntroSeen = (): void => {
  if (!hasWindow()) {
    return;
  }

  window.sessionStorage.setItem(INTRO_SEEN_KEY, '1');
};

export const resetIntroGate = (): void => {
  if (!hasWindow()) {
    return;
  }

  window.sessionStorage.removeItem(INTRO_SEEN_KEY);
};
