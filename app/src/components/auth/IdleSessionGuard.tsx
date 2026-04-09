"use client";

import { signOut } from "next-auth/react";
import { useEffect, useRef } from "react";

const IDLE_TIMEOUT_MS = 15 * 60 * 1000;
const ACTIVITY_PING_THROTTLE_MS = 15 * 1000;
const LAST_ACTIVITY_STORAGE_PREFIX = "jontaado_last_activity";

function getStorageKey(userId: string) {
  return `${LAST_ACTIVITY_STORAGE_PREFIX}:${userId}`;
}

function readLastActivity(storageKey: string) {
  if (typeof window === "undefined") {
    return Date.now();
  }

  const raw = window.localStorage.getItem(storageKey);
  const parsed = raw ? Number(raw) : NaN;
  return Number.isFinite(parsed) ? parsed : Date.now();
}

type IdleSessionGuardProps = {
  locale: string;
  userId?: string | null;
};

export default function IdleSessionGuard({
  locale,
  userId,
}: IdleSessionGuardProps) {
  const timeoutRef = useRef<number | null>(null);
  const lastPersistedAtRef = useRef(0);
  const signOutStartedRef = useRef(false);

  useEffect(() => {
    if (!userId || typeof window === "undefined") {
      return;
    }

    const storageKey = getStorageKey(userId);

    const clearScheduledSignOut = () => {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };

    const triggerSignOut = () => {
      if (signOutStartedRef.current) {
        return;
      }

      signOutStartedRef.current = true;
      void signOut({
        callbackUrl: `/${locale}?reason=inactive`,
      });
    };

    const scheduleFrom = (timestamp: number) => {
      clearScheduledSignOut();
      const remaining = IDLE_TIMEOUT_MS - (Date.now() - timestamp);

      if (remaining <= 0) {
        triggerSignOut();
        return;
      }

      timeoutRef.current = window.setTimeout(triggerSignOut, remaining);
    };

    const persistActivity = (force = false) => {
      const now = Date.now();
      if (!force && now - lastPersistedAtRef.current < ACTIVITY_PING_THROTTLE_MS) {
        return;
      }

      lastPersistedAtRef.current = now;
      window.localStorage.setItem(storageKey, String(now));
      scheduleFrom(now);
    };

    const bootstrapLastActivity = readLastActivity(storageKey);
    lastPersistedAtRef.current = bootstrapLastActivity;
    if (Date.now() - bootstrapLastActivity >= IDLE_TIMEOUT_MS) {
      triggerSignOut();
      return;
    }

    window.localStorage.setItem(storageKey, String(bootstrapLastActivity));
    scheduleFrom(bootstrapLastActivity);

    const handleVisibleCheck = () => {
      const latestActivity = readLastActivity(storageKey);
      if (Date.now() - latestActivity >= IDLE_TIMEOUT_MS) {
        triggerSignOut();
        return;
      }

      lastPersistedAtRef.current = latestActivity;
      scheduleFrom(latestActivity);
    };

    const handleActivity = () => persistActivity();
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        handleVisibleCheck();
      }
    };
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== storageKey) {
        return;
      }

      handleVisibleCheck();
    };

    persistActivity(true);

    const activityEvents: Array<keyof WindowEventMap> = [
      "mousedown",
      "keydown",
      "scroll",
      "touchstart",
      "mousemove",
      "focus",
    ];

    activityEvents.forEach((eventName) => {
      window.addEventListener(eventName, handleActivity, { passive: true });
    });
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("storage", handleStorage);

    return () => {
      clearScheduledSignOut();
      activityEvents.forEach((eventName) => {
        window.removeEventListener(eventName, handleActivity);
      });
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("storage", handleStorage);
    };
  }, [locale, userId]);

  return null;
}
