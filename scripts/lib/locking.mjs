export function completeSourceLock(lockConfig, snapshots) {
  const updatedLock = structuredClone(lockConfig);
  for (const lock of updatedLock.sources) {
    const snapshot = snapshots.get(lock.name);
    if (!snapshot) {
      throw new Error(`Missing verified source snapshot for ${lock.name}.`);
    }
    lock.lockState = 'locked';
    lock.source.skillHash = snapshot.inspection.hash;
    delete lock.unresolvedReason;
  }
  return updatedLock;
}
