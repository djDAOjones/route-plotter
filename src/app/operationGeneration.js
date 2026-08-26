/**
 * Tokens for async authoring operations. A project replacement (Open/Clear)
 * invalidates every outstanding token; starting a newer operation on the same
 * channel invalidates only that channel's older request.
 */

export function invalidateProjectOperations(app) {
  app._projectGeneration = (app._projectGeneration || 0) + 1;
  return app._projectGeneration;
}

export function advanceEditRevision(app) {
  app._editRevision = (app._editRevision || 0) + 1;
  return app._editRevision;
}

export function beginAsyncProjectOperation(app, channel, { replaceProject = false } = {}) {
  if (!channel) throw new Error('Async project operation requires a channel');
  if (replaceProject) {
    invalidateProjectOperations(app);
    advanceEditRevision(app);
  }

  if (!(app._asyncProjectOperations instanceof Map)) {
    app._asyncProjectOperations = new Map();
  }
  const requestId = (app._asyncProjectOperations.get(channel) || 0) + 1;
  app._asyncProjectOperations.set(channel, requestId);
  return {
    projectGeneration: app._projectGeneration || 0,
    channel,
    requestId,
  };
}

export function isAsyncProjectOperationCurrent(app, token) {
  return Boolean(token) &&
    (app._projectGeneration || 0) === token.projectGeneration &&
    app._asyncProjectOperations instanceof Map &&
    app._asyncProjectOperations.get(token.channel) === token.requestId;
}
