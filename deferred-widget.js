(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.MomentumDeferredWidget = factory();
})(typeof window === 'object' ? window : globalThis, function () {
  'use strict';
  function defer(target, callback, scope = globalThis) {
    let observer, started = false, disposed = false;
    function run() {
      if (started || disposed) return;
      started = true;
      if (observer) observer.disconnect();
      callback();
    }
    if (target && typeof scope.IntersectionObserver === 'function') {
      observer = new scope.IntersectionObserver(entries => {
        if (entries.some(entry => entry.isIntersecting)) run();
      }, { rootMargin: '180px 0px' });
      observer.observe(target);
    } else run();
    return { run, dispose() { disposed = true; if (observer) observer.disconnect(); } };
  }
  return { defer };
});
