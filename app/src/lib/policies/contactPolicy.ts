export type ContactPolicyParams = {
  viewerId?: string | null;
  viewerRole?: string | null;
  ownerId?: string | null;
  unlockedByStatus?: boolean;
  lockedByDefault?: boolean;
  unlockStatusHint?: string | null;
};

export type ContactPolicyResult = {
  canRevealContact: boolean;
  contactLocked: boolean;
  contactUnlockStatusHint: string | null;
};

export function evaluateContactPolicy(params: ContactPolicyParams): ContactPolicyResult {
  const {
    viewerId,
    viewerRole,
    ownerId,
    unlockedByStatus = false,
    lockedByDefault = true,
    unlockStatusHint = null,
  } = params;

  const isAdmin = viewerRole === "ADMIN";
  const isOwner = Boolean(viewerId && ownerId && viewerId === ownerId);

  const canRevealContact = !lockedByDefault || isAdmin || isOwner || unlockedByStatus;

  return {
    canRevealContact,
    contactLocked: !canRevealContact,
    contactUnlockStatusHint: canRevealContact ? null : unlockStatusHint,
  };
}
