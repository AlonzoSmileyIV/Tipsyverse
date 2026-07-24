// src/hooks/useTutorialGate.js
import { useMemo } from "react";
import { useSelector } from "react-redux";

const LS_KEY = "hasSeenTutorial";

export default function useTutorialGate(user) {
  const blocking = useSelector((s) => s.ui?.blockingModal ?? null);
  return useMemo(() => {
    if (blocking) return { shouldShow: false };
    const storageKey = user?._id ? `${LS_KEY}-${user._id}` : LS_KEY;
    const lsSeen = localStorage.getItem(storageKey) === "true";
    const serverSeen = !!user?.preferences?.hasSeenTutorial; // true means already seen
    return { shouldShow: !(lsSeen || serverSeen) };
  }, [blocking, user?._id, user?.preferences?.hasSeenTutorial]);
}
