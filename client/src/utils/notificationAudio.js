let audio;
const NOTIFICATION_VOLUME = 0.3;
const NOTIFICATION_SOUND_SRC = "/sounds/notification.mp3";

export const primeAudio = () => {
  if (!audio) {
    audio = new Audio(NOTIFICATION_SOUND_SRC);
    audio.preload = "auto";
    audio.volume = NOTIFICATION_VOLUME;
    audio.load();
  }
};

export const playNotificationSound = () => {
  if (!audio) {
    primeAudio();
  }

  if (audio) {
    audio.volume = NOTIFICATION_VOLUME;
    audio.currentTime = 0;
    const playPromise = audio.play();

    if (playPromise !== undefined) {
      playPromise.catch((err) =>
        console.warn("Notification sound was blocked:", err.message)
      );
    }
  }
};
