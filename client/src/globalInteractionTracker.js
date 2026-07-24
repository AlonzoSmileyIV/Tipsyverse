import { primeAudio } from "./utils/notificationAudio";

if (typeof window !== "undefined" && !window.userHasInteracted) {
  const setInteractionFlag = () => {
    if (!window.userHasInteracted) {
      window.userHasInteracted = true;
      primeAudio();
      cleanup();
    }
  };

  const cleanup = () => {
    window.removeEventListener("click", setInteractionFlag);
    window.removeEventListener("keydown", setInteractionFlag);
    window.removeEventListener("scroll", setInteractionFlag);
  };

  // Browser audio can only be unlocked from a real user gesture.
  window.addEventListener("click", setInteractionFlag);
  window.addEventListener("keydown", setInteractionFlag);
  window.addEventListener("scroll", setInteractionFlag);
}
