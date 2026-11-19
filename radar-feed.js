(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.MomentumRadarFeed = factory();
})(typeof window === 'object' ? window : globalThis, function () {
  'use strict';
  function create({ products, onMessage, onState, Socket = WebSocket, now = Date.now,
    later = setTimeout, cancel = clearTimeout, every = setInterval, stopEvery = clearInterval }) {
    let socket = null, retryTimer = null, watchdog = null, active = false, attempts = 0, lastActivity = 0, receiving = false;
    function cleanup() {
      const old = socket; socket = null;
      if (old) old.close();
      cancel(retryTimer); retryTimer = null;
      stopEvery(watchdog); watchdog = null;
    }
    function pause(reason = 'manual') { active = false; cleanup(); onState('paused', { reason, attempts }); }
    function recover(reason) {
      cleanup();
      if (!active) return;
      if (attempts >= 3) { active = false; onState('stopped', { reason, attempts }); return; }
      attempts++;
      const delay = 1000 * 2 ** attempts;
      onState('reconnecting', { reason, attempts, delay });
      retryTimer = later(() => { retryTimer = null; if (active) connect(); }, delay);
    }
    function connect() {
      receiving = false; lastActivity = now();
      onState('connecting', { attempts });
      let current;
      try { current = new Socket('wss://ws-feed.exchange.coinbase.com'); }
      catch (_) { recover('network'); return; }
      socket = current;
      current.onopen = () => {
        if (socket !== current || !active) return;
        try { current.send(JSON.stringify({ type: 'subscribe', product_ids: products, channels: ['ticker', 'heartbeat'] })); }
        catch (_) { recover('network'); return; }
        onState('waiting', { attempts });
      };
      current.onmessage = event => {
        if (socket !== current || !active) return;
        let message;
        try { message = JSON.parse(event.data); } catch (_) { return; }
        if (!message || typeof message !== 'object') return;
        if (message.type === 'error') { active = false; cleanup(); onState('stopped', { reason: 'provider', attempts }); return; }
        const time = Date.parse(message.time), receivedAt = now();
        if (message.type === 'heartbeat' && products.includes(message.product_id)
            && Number.isFinite(time) && receivedAt - time <= 15000 && time - receivedAt <= 5000) {
          lastActivity = receivedAt; return;
        }
        if (onMessage(message, receivedAt) === true) {
          lastActivity = receivedAt;
          if (!receiving) { receiving = true; onState('receiving', { attempts }); }
        }
      };
      current.onerror = () => { if (socket === current) recover('network'); };
      current.onclose = () => { if (socket === current) recover('closed'); };
      watchdog = every(() => { if (active && now() - lastActivity > 20000) recover('timeout'); }, 1000);
    }
    function start() { if (active) return; active = true; attempts = 0; connect(); }
    return { start, pause };
  }
  return { create };
});
