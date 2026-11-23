/**
 * Guest locked titles → Sign in (then watch plays if entitled, else pricing).
 * Signed-in locked titles → Premium plans.
 */
export function lockedContentHref(slug, signedIn) {
  const watchPath = `/watch/${slug}`;
  if (signedIn) {
    return `/pricing?next=${encodeURIComponent(watchPath)}`;
  }
  return `/login?next=${encodeURIComponent(watchPath)}`;
}

export function lockedContentBadge(signedIn) {
  return signedIn ? "Premium" : "Sign in";
}

export function lockedContentPrimaryLabel(signedIn) {
  return signedIn ? "View Premium" : "Sign in";
}
