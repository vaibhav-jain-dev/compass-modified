'use strict';
// Fork-specific. `npm run start` / `start-web` wrap the dev server in several
// npm and sh processes. Killing one of the wrappers (closing a terminal tab,
// `timeout`, a task runner) used to leave the node dev server running as an
// orphan, still holding its ports. This makes the server follow its parent
// and gives every termination signal a hard deadline.

const EXIT_GRACE_MS = 3000;
const PARENT_POLL_MS = 1000;

function install() {
  const initialPpid = process.ppid;
  const parentWatch = setInterval(() => {
    if (process.ppid !== initialPpid) {
      // eslint-disable-next-line no-console
      console.error(
        '[webpack-compass] parent process is gone, shutting down the dev server'
      );
      process.exit(0);
    }
  }, PARENT_POLL_MS);
  // Must not keep the event loop alive on its own.
  parentWatch.unref();

  for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
    process.on(signal, () => {
      // webpack-dev-server stops gracefully on SIGINT/SIGTERM, but a browser
      // holding a websocket open can keep that from finishing. Give it a
      // moment, then leave regardless.
      const deadline = setTimeout(() => {
        process.exit(signal === 'SIGINT' ? 130 : 0);
      }, EXIT_GRACE_MS);
      deadline.unref();
      if (signal === 'SIGHUP') {
        process.exit(0);
      }
    });
  }
}

module.exports = { install };
