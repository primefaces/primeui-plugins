export function completeSourceLock(lockConfig, snapshots) {
  const updatedLock = structuredClone(lockConfig);
  for (const lock of updatedLock.sources) {
    const snapshot = snapshots.get(lock.name);
    if (!snapshot) {
      throw new Error(`Missing verified source snapshot for ${lock.name}.`);
    }
    lock.lockState = 'locked';
    for (const [index, skill] of lock.skills.entries()) {
      const skillSnapshot = snapshot.skills[index];
      if (!skillSnapshot || skillSnapshot.id !== skill.id) {
        throw new Error(`Missing verified source snapshot for ${lock.name}/${skill.id}.`);
      }
      skill.source.treeHash = skillSnapshot.inspection.hash;
    }
    delete lock.unresolvedReason;
  }
  return updatedLock;
}
