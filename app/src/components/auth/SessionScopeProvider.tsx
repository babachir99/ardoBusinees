"use client";

import { createContext, useContext } from "react";
import { useSession } from "next-auth/react";

const SessionScopeContext = createContext<string | null>(null);

export function SessionScopeProvider({
  initialUserId,
  children,
}: {
  initialUserId: string | null;
  children: React.ReactNode;
}) {
  const { data: session, status } = useSession();
  const liveUserId =
    typeof session?.user?.id === "string" && session.user.id.trim()
      ? session.user.id
      : null;
  const resolvedUserId = status === "loading" ? initialUserId : liveUserId;

  return (
    <SessionScopeContext.Provider value={resolvedUserId}>
      {children}
    </SessionScopeContext.Provider>
  );
}

export function useSessionUserId() {
  return useContext(SessionScopeContext);
}
