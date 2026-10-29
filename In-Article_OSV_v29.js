(function mcOutstreamPlayer() {

  /* =====================================================================
   * OSV GA4 FUNNEL TRACKING  (measurement only; player behaviour unchanged)
   *
   * Isolation from Moneycontrol's own GA / GTM:
   *  - Uses its OWN dataLayer ("mcOsvDataLayer") and its OWN command function
   *    ("mcOsvGtag"). window.dataLayer and window.gtag are never touched.
   *  - send_page_view: false -> no page_view is sent by this tag at all.
   *  - cookie_prefix "mcosv" -> separate cookies; Moneycontrol's _ga cookies
   *    are not read or rewritten.
   *  - Every event carries send_to: G-YJ12EE9TXN, so nothing can be routed
   *    to another property.
   *
   * Sampling: decided once per page view (OSV_SAMPLE_RATE). Multiply GA4
   * counts by 1 / OSV_SAMPLE_RATE before comparing with GAM numbers.
   * Debug: add ?osv_debug=1 to any page URL -> 100% tracking, GA4 DebugView,
   * and console logs ("[OSV GA4] ...").
   * ===================================================================== */
  var OSV_GA_ID = "G-YJ12EE9TXN";
  var OSV_DATALAYER = "mcOsvDataLayer";
  var OSV_GTAG_FN = "mcOsvGtag";
  var OSV_SAMPLE_RATE = 0.1;          // 10% of page views
  var OSV_VERSION = "orig_ga_v1";
  var OSV_MAX_PER_EVENT = 30;         // per event name, per page view (stops midroll loops flooding GA)
  var OSV_MAX_ERRORS = 5;             // js/promise errors per page view
  var OSV_STAGES = ["none", "executed", "player_created", "ima_ready",
                    "vast_requested", "ads_loaded", "ad_started", "ad_impression"];

  // Track in the top window when reachable, so all executions on one page
  // share one tracker even if the creative runs inside a friendly iframe.
  var OSV_WIN = (function () {
    try { if (window.top && window.top.document && window.top.location.href) return window.top; } catch (e) {}
    return window;
  })();
  var OSV_SCRIPT_SRC = (document.currentScript && document.currentScript.src) || "";

  function osvNow() {
    try { return Math.round(OSV_WIN.performance.now()); } catch (e) { return 0; }
  }

  function osvExtend(target, src) {
    for (var k in src) {
      if (Object.prototype.hasOwnProperty.call(src, k) && src[k] !== undefined && src[k] !== null && src[k] !== "") {
        target[k] = src[k];
      }
    }
    return target;
  }

  function osvCreateTracker() {
    var W = OSV_WIN, d = W.document;
    var debug = /[?&]osv_debug=1/.test(W.location.search || "");
    var T = {
      sampled: debug || Math.random() < OSV_SAMPLE_RATE,
      debug: debug,
      pvId: Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8),
      device: /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) ? "mobile" : "desktop",
      execCount: 0,
      counts: {},
      stage: 0,
      times: {},
      flags: { near_vp: 0, in_view: 0, ima_failed: 0, dup: 0, hidden_at_exec: 0, became_visible: 0, content_played: 0 },
      n: { requests: 0, loaded: 0, impressions: 0, ima_errors: 0, timeouts: 0, js_errors: 0 },
      summarySent: false
    };

    if (T.sampled) {
      W[OSV_DATALAYER] = W[OSV_DATALAYER] || [];
      if (typeof W[OSV_GTAG_FN] !== "function") {
        W[OSV_GTAG_FN] = function () { W[OSV_DATALAYER].push(arguments); };
      }
      var cfg = {
        send_page_view: false,
        cookie_prefix: "mcosv",
        allow_google_signals: false,
        allow_ad_personalization_signals: false
      };
      if (debug) cfg.debug_mode = true;
      W[OSV_GTAG_FN]("js", new Date());
      W[OSV_GTAG_FN]("config", OSV_GA_ID, cfg);

      var s = d.createElement("script");
      s.async = true;
      s.src = "https://www.googletagmanager.com/gtag/js?id=" + OSV_GA_ID + "&l=" + OSV_DATALAYER;
      (d.head || d.documentElement).appendChild(s);
    }

    T.send = function (name, params) {
      T.counts[name] = (T.counts[name] || 0) + 1;
      if (T.counts[name] > OSV_MAX_PER_EVENT) return;
      var p = osvExtend({
        send_to: OSV_GA_ID,
        pv_id: T.pvId,
        exec_n: T.execCount,
        osv_ver: OSV_VERSION,
        device_kind: T.device,
        t_ms: osvNow(),
        vis_state: d.visibilityState || "na"
      }, params || {});
      if (T.debug && W.console) W.console.log("[OSV GA4]", name, p);
      if (T.sampled) { try { W[OSV_GTAG_FN]("event", name, p); } catch (e) {} }
    };

    T.reach = function (stageName) {
      var i = OSV_STAGES.indexOf(stageName);
      if (i > T.stage) T.stage = i;
      if (T.times[stageName] === undefined) T.times[stageName] = osvNow();
    };

    T.sinceExec = function () {
      return T.times.executed !== undefined ? osvNow() - T.times.executed : undefined;
    };

    // One snapshot per page view, sent when the page is first hidden or unloaded.
    T.sendSummary = function (reason) {
      if (T.summarySent || T.execCount === 0) return;
      T.summarySent = true;
      T.send("osv_page_summary", {
        transport_type: "beacon",
        summary_reason: reason,
        max_stage: OSV_STAGES[T.stage],
        near_vp: T.flags.near_vp,
        in_view: T.flags.in_view,
        ima_failed: T.flags.ima_failed,
        hidden_at_exec: T.flags.hidden_at_exec,
        became_visible: T.flags.became_visible,
        dup_blocks: T.flags.dup,
        content_played: T.flags.content_played,
        n_requests: T.n.requests,
        n_loaded: T.n.loaded,
        n_impressions: T.n.impressions,
        n_ima_errors: T.n.ima_errors,
        n_timeouts: T.n.timeouts,
        n_js_errors: T.n.js_errors,
        ms_to_ima: T.times.ima_ready,
        ms_to_request: T.times.vast_requested,
        ms_to_impression: T.times.ad_impression
      });
    };

    d.addEventListener("visibilitychange", function () {
      if (d.visibilityState === "hidden") { T.sendSummary("hidden"); return; }
      if (T.flags.hidden_at_exec && !T.flags.became_visible) {
        T.flags.became_visible = 1;
        T.send("osv_page_visible", { ms_since_exec: T.sinceExec() });
      }
    });
    W.addEventListener("pagehide", function () { T.sendSummary("pagehide"); });

    return T;
  }

  var OSV;
  try {
    OSV = OSV_WIN.__MC_OSV_TRACK__ || (OSV_WIN.__MC_OSV_TRACK__ = osvCreateTracker());
  } catch (e) {
    // Tracking must never break the player.
    OSV = { send: function () {}, reach: function () {}, sinceExec: function () {}, sendSummary: function () {},
            flags: {}, n: {}, times: {}, execCount: 0 };
  }

  OSV.execCount++;
  if (OSV.execCount === 1) {
    OSV.reach("executed");
    try { if (OSV_WIN.document.visibilityState === "hidden") OSV.flags.hidden_at_exec = 1; } catch (e) {}
  }

  OSV.send("osv_code_executed", {
    in_top: (function () { try { return window.top === window ? 1 : 0; } catch (e) { return 0; } })(),
    is_duplicate: window.__MC_OUTSTREAM_LOADED__ ? 1 : 0,
    ready_state: document.readyState,
    prerender: document.prerendering ? 1 : 0,
    has_io: ("IntersectionObserver" in window) ? 1 : 0,
    has_after: (typeof Element !== "undefined" && Element.prototype.after) ? 1 : 0,
    script_src_known: OSV_SCRIPT_SRC ? 1 : 0
  });

  if (window.__MC_OUTSTREAM_LOADED__) {
    OSV.flags.dup++;
    OSV.send("osv_duplicate_blocked", { dup_n: OSV.flags.dup });
    return;
  }
  window.__MC_OUTSTREAM_LOADED__ = true;

  /* ---------------- error capture helpers ---------------- */

  var osvContainerRef = null;
  var osvReqSeq = 0, osvLatestReqId = 0, osvLatestCtx = {};

  function osvFirstFrame(stack) {
    var lines = String(stack || "").split("\n");
    for (var i = 1; i < lines.length; i++) {
      var l = lines[i].trim();
      if (l) return l.slice(0, 100);
    }
    return "";
  }

  function osvReportError(err, where, kind) {
    if (err && typeof err === "object") {
      if (err.__osvTracked) return;
      try { err.__osvTracked = true; } catch (e) {}
    }
    OSV.n.js_errors = (OSV.n.js_errors || 0) + 1;
    if (OSV.n.js_errors > OSV_MAX_ERRORS) return;
    OSV.send(kind === "promise" ? "osv_promise_error" : "osv_js_error", {
      error_where: where,
      error_msg: String((err && err.message) || err || "unknown").slice(0, 100),
      error_frame: osvFirstFrame(err && err.stack),
      error_stage: OSV_STAGES[OSV.stage]
    });
  }

  // Wraps a callback: reports the exception, then rethrows so behaviour is unchanged.
  function osvGuard(where, fn) {
    return function () {
      try { return fn.apply(this, arguments); }
      catch (err) { osvReportError(err, where, "js"); throw err; }
    };
  }

  function osvIsOurs(stack, filename) {
    stack = String(stack || "");
    if (OSV_SCRIPT_SRC && (filename === OSV_SCRIPT_SRC || stack.indexOf(OSV_SCRIPT_SRC) !== -1)) return true;
    return stack.indexOf("mcOutstreamPlayer") !== -1;
  }

  function osvIsOurElement(el) {
    if (!el || el.nodeType !== 1) return false;
    if (el.hasAttribute && (el.hasAttribute("data-mc-ima") || el.hasAttribute("data-mc-hls"))) return true;
    return !!(osvContainerRef && osvContainerRef.contains(el));
  }

  // Capture phase so resource load errors (scripts, images) are seen too.
  // Errors from the rest of the Moneycontrol page are ignored.
  window.addEventListener("error", function (ev) {
    try {
      var tg = ev.target;
      if (tg && tg !== window && tg.nodeType === 1) {
        if (tg.id === "mc-video") return;               // reported as osv_content_error
        if (osvIsOurElement(tg)) {
          OSV.n.js_errors = (OSV.n.js_errors || 0) + 1;
          if (OSV.n.js_errors <= OSV_MAX_ERRORS) {
            OSV.send("osv_js_error", {
              error_where: "resource",
              error_msg: ("load_failed:" + tg.tagName.toLowerCase()),
              error_frame: String(tg.src || tg.currentSrc || "").slice(0, 100),
              error_stage: OSV_STAGES[OSV.stage]
            });
          }
        }
        return;
      }
      var err = ev.error;
      if (err && err.__osvTracked) return;
      if (osvIsOurs(err && err.stack, ev.filename)) osvReportError(err || ev.message, "window", "js");
    } catch (e) {}
  }, true);

  window.addEventListener("unhandledrejection", function (ev) {
    try {
      var r = ev.reason;
      if (r && r.__osvTracked) return;
      if (r && r.target && osvIsOurElement(r.target)) {
        try { r.__osvTracked = true; } catch (e) {}
        osvReportError({ message: "script_load_failed:" + String(r.target.src || "").slice(0, 70) }, "promise", "promise");
        return;
      }
      if (osvIsOurs(r && r.stack, "")) osvReportError(r, "promise", "promise");
    } catch (e) {}
  });

  /* =====================================================================
   * ORIGINAL PLAYER CODE (unchanged behaviour; OSV.* calls added)
   * ===================================================================== */
  try {

  const doc = document;
  const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
  const IS_GLOBAL_INDICES_PAGE = location.pathname.toLowerCase().includes("/markets/global-indices/");

  const WIDTH  = isMobile ? 340 : 512;
  const HEIGHT = isMobile ? 190 : 288;

  const INSERT_AFTER_P = 3;
  const MIDROLL_INTERVAL = 5;
  const ENABLE_STICKY = false;

  const STICKY_BOTTOM = isMobile ? 110 : 12;
  const STICKY_TOP = 50;

  const BTN_SIZE = isMobile ? 40 : 50;
  const BTN_LEFT_MARGIN = isMobile ? 5 : 0;

  const THUMBNAIL_URL = "https://images.moneycontrol.com/images/2019/english/inters_logo.jpg";

  const PREROLL_PREFETCH_MARGIN = "400px 0px";
  const PREROLL_TIMEOUT_MS = 1800;

  const CONTENT_VIDEOS = [
    "https://media-moneycontrol.akamaized.net/1234562/manifest.m3u8",
    "https://media-moneycontrol.akamaized.net/1234563/manifest.m3u8",
    "https://media-moneycontrol.akamaized.net/1234564/manifest.m3u8",
    "https://media-moneycontrol.akamaized.net/1234565/manifest.m3u8",
    "https://media-moneycontrol.akamaized.net/1234566/manifest.m3u8"
  ];

  const CONTENT_VIDEO = CONTENT_VIDEOS[
    Math.floor(Math.random() * CONTENT_VIDEOS.length)
  ];

  const PREROLL_WATERFALL = [
    "https://pubads.g.doubleclick.net/gampad/ads?iu=/1039154/Inhouse_Video_1_1&tfcd=0&npa=0&sz=400x300%7C640x360%7C640x480%7C800x450%7C300x250%7C1x1%7C635x357%7C444x250%7C419x236%7C333x250&gdfp_req=1&unviewed_position_start=1&output=xml_vast4&max_redirects=3&env=instream&vpos=preroll&impl=s&plcmt=2&vad_type=linear&ad_type=audio_video&vpw=640&vph=360&min_ad_duration=5000&max_ad_duration=60000",
    "https://pubads.g.doubleclick.net/gampad/ads?iu=/1039154/Inhouse_Video_1_2&tfcd=0&npa=0&sz=400x300%7C640x360%7C640x480%7C800x450%7C300x250%7C1x1%7C635x357%7C444x250%7C419x236%7C333x250&gdfp_req=1&unviewed_position_start=1&output=xml_vast4&max_redirects=3&env=instream&vpos=preroll&impl=s&plcmt=2&vad_type=linear&ad_type=audio_video&vpw=640&vph=360&min_ad_duration=5000&max_ad_duration=60000",
    "https://pubads.g.doubleclick.net/gampad/ads?iu=/1039154/Inhouse_Video_1_3&tfcd=0&npa=0&sz=400x300%7C640x360%7C640x480%7C800x450%7C300x250%7C1x1%7C635x357%7C444x250%7C419x236%7C333x250&gdfp_req=1&unviewed_position_start=1&output=xml_vast4&max_redirects=3&env=instream&vpos=preroll&impl=s&plcmt=2&vad_type=linear&ad_type=audio_video&vpw=640&vph=360&min_ad_duration=5000&max_ad_duration=60000"
  ];
  const MIDROLL_WATERFALL = [
    "https://pubads.g.doubleclick.net/gampad/ads?iu=/1039154/Inhouse_Video_1_4&tfcd=0&npa=0&sz=400x300%7C640x360%7C640x480%7C800x450%7C300x250%7C1x1%7C635x357%7C444x250%7C419x236%7C333x250&gdfp_req=1&unviewed_position_start=1&output=xml_vast4&max_redirects=3&env=instream&vpos=midroll&impl=s&plcmt=2&vad_type=linear&ad_type=audio_video&vpw=640&vph=360&min_ad_duration=5000&max_ad_duration=60000",
    "https://pubads.g.doubleclick.net/gampad/ads?iu=/1039154/Inhouse_Video_1_5&tfcd=0&npa=0&sz=400x300%7C640x360%7C640x480%7C800x450%7C300x250%7C1x1%7C635x357%7C444x250%7C419x236%7C333x250&gdfp_req=1&unviewed_position_start=1&output=xml_vast4&max_redirects=3&env=instream&vpos=midroll&impl=s&plcmt=2&vad_type=linear&ad_type=audio_video&vpw=640&vph=360&min_ad_duration=5000&max_ad_duration=60000",
    "https://pubads.g.doubleclick.net/gampad/ads?iu=/1039154/Inhouse_Video_1_6&tfcd=0&npa=0&sz=400x300%7C640x360%7C640x480%7C800x450%7C300x250%7C1x1%7C635x357%7C444x250%7C419x236%7C333x250&gdfp_req=1&unviewed_position_start=1&output=xml_vast4&max_redirects=3&env=instream&vpos=midroll&impl=s&plcmt=2&vad_type=linear&ad_type=audio_video&vpw=640&vph=360&min_ad_duration=5000&max_ad_duration=60000"
  ];

  let prerollIndex = 0;
  let midrollIndex = 0;

  let adsLoader = null, adsManager = null, adc = null;
  let lastMidrollTime = 0, midrollPlaying = false, adPlaying = false, playerKilled = false, isPreroll = true;
  let viewable = false, adsManagerReady = false, adsStarted = false;
  let prerollRequested = false;
  let prerollTimer = null;
  let isFloating = false;
  let cachedInlineTop = null;
  let userDismissedFloat = false;

  let hlsReady = null;
  let imaReady = null;

  const container = doc.createElement("div");
  container.id = "mc-outstream-player";
  container.style.cssText = `
    width:${WIDTH}px;
    height:${HEIGHT}px;
    background:#000;
    margin:${isMobile ? "15px auto 20px auto" : "15px auto"};
    position:relative;
    z-index:88888;
    opacity:1;
    visibility:visible;
    pointer-events:auto;
  `;
  osvContainerRef = container;

  const placeholder = doc.createElement("div");
  placeholder.style.width = WIDTH + "px";
  placeholder.style.height = HEIGHT + "px";
  placeholder.style.margin = isMobile ? "15px auto 20px auto" : "15px auto";
  placeholder.style.display = "none";

  const uiStyles = doc.createElement("style");
  uiStyles.textContent = `
    #mc-outstream-player {
      border-radius: 10px;
      overflow: hidden;
    }
    .mc-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      border: none;
      border-radius: 50%;
      cursor: pointer;
      backdrop-filter: blur(6px);
      -webkit-backdrop-filter: blur(6px);
      background: rgba(10, 10, 10, 0.55);
      border: 1px solid rgba(255,255,255,0.12);
      box-shadow: 0 2px 8px rgba(0,0,0,0.45);
      transition: background 0.2s ease, transform 0.15s ease, box-shadow 0.2s ease;
      color: #fff;
      padding: 0;
      line-height: 1;
    }
    .mc-btn:hover {
      background: rgba(30, 30, 30, 0.85);
      transform: scale(1.1);
      box-shadow: 0 4px 14px rgba(0,0,0,0.6);
    }
    .mc-btn:active {
      transform: scale(0.95);
    }
    #mc-playpause-overlay {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%) scale(0.85);
      width: ${isMobile ? 52 : 64}px;
      height: ${isMobile ? 52 : 64}px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      background: rgba(10, 10, 10, 0.55);
      border: 1.5px solid rgba(255,255,255,0.18);
      box-shadow: 0 4px 20px rgba(0,0,0,0.5);
      cursor: pointer;
      z-index: 1999;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.2s ease, transform 0.2s ease;
    }
    #mc-outstream-player:not([data-ad-playing="true"]):hover #mc-playpause-overlay {
      opacity: 1;
      pointer-events: auto;
      transform: translate(-50%, -50%) scale(1);
    }
    #mc-playpause-overlay:hover {
      background: rgba(30, 30, 30, 0.8);
      box-shadow: 0 6px 24px rgba(0,0,0,0.65);
    }
    #mc-playpause-overlay:active {
      transform: translate(-50%, -50%) scale(0.93) !important;
    }
    #mc-playpause-overlay.mc-flash {
      animation: mc-ripple 0.3s ease forwards;
    }
    @keyframes mc-ripple {
      0%   { box-shadow: 0 0 0 0 rgba(255,255,255,0.35); }
      100% { box-shadow: 0 0 0 18px rgba(255,255,255,0); }
    }
  `;
  doc.head.appendChild(uiStyles);

  container.innerHTML = `
    <div id="mc-thumb" style="
      position:absolute;
      top:50%;
      left:0;
      transform:translateY(-50%);
      width:100%;
      height:100%;
      display:flex;
      align-items:center;
      justify-content:center;
      background:#000;
      border-radius:8px;
      z-index:2001;
    ">
      <img src="${THUMBNAIL_URL}" style="
        max-width:90%;
        max-height:90%;
        object-fit:contain;
        pointer-events:none;
        user-select:none;
      ">
    </div>

    <video id="mc-video" playsinline muted style="
      width:100%; height:100%; background:transparent; opacity:0; border-radius:8px;">
    </video>

    <div id="mc-ad-layer" style="
      position:absolute; top:0; left:0;
      width:100%; height:100%;
      z-index:1000;"></div>

    <button id="mc-playpause-overlay" aria-label="Play / Pause">
      <svg id="mc-pp-icon" xmlns="http://www.w3.org/2000/svg" width="${isMobile ? 22 : 26}" height="${isMobile ? 22 : 26}" viewBox="0 0 24 24" fill="white">
        <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
      </svg>
    </button>

    <button id="mc-close" class="mc-btn" style="
      position:absolute; top:10px; left:${BTN_LEFT_MARGIN + 10}px;
      width:${BTN_SIZE}px; height:${BTN_SIZE}px;
      display:none; z-index:2000;"
      aria-label="Close player">
      <svg xmlns="http://www.w3.org/2000/svg" width="${isMobile ? 16 : 18}" height="${isMobile ? 16 : 18}" fill="white" viewBox="0 0 24 24">
        <path d="M18.3 5.71a1 1 0 00-1.42 0L12 10.59 7.12 5.7A1 1 0 105.7 7.12L10.59 12l-4.88 4.88a1 1 0 101.41 1.41L12 13.41l4.88 4.88a1 1 0 001.42-1.42L13.41 12l4.88-4.88a1 1 0 000-1.41z"/>
      </svg>
    </button>

    <button id="mc-mute" class="mc-btn" style="
      position:absolute; bottom:10px; left:${BTN_LEFT_MARGIN + 10}px;
      width:${BTN_SIZE}px; height:${BTN_SIZE}px;
      display:none; z-index:2000;"
      aria-label="Toggle mute">
      <svg id="mc-mute-icon" xmlns="http://www.w3.org/2000/svg" width="${isMobile ? 17 : 20}" height="${isMobile ? 17 : 20}" fill="white" viewBox="0 0 24 24">
        <path d="M16.5 12A4.5 4.5 0 0014 7.97v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51A8.796 8.796 0 0021 12c0-4.28-3-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06a8.99 8.99 0 003.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>
      </svg>
    </button>
  `;

  function getInlineTop() {
    if (cachedInlineTop === null) {
      const measureEl = isFloating ? placeholder : container;
      const rect = measureEl.getBoundingClientRect();
      cachedInlineTop = rect.top + window.scrollY;
    }
    return cachedInlineTop;
  }

  window.addEventListener("resize", () => {
    cachedInlineTop = null;
  });

  function returnToInline() {
    if (!isFloating) return;
    isFloating = false;
    cachedInlineTop = null;

    placeholder.style.display = "none";

    container.style.position = "relative";
    container.style.top = "auto";
    container.style.bottom = "auto";
    container.style.left = "auto";
    container.style.right = "auto";
    container.style.transform = "none";
    container.style.margin = isMobile ? "15px auto 20px auto" : "15px auto";

    closeBtn.style.display = "none";
  }

  let scrollRafPending = false;

  window.addEventListener("scroll", () => {
    if (!ENABLE_STICKY || scrollRafPending) return;
    scrollRafPending = true;

    requestAnimationFrame(() => {
      scrollRafPending = false;

      const y = window.scrollY;
      const inlineTop = getInlineTop();
      const shouldFloat = y > inlineTop + 300;

      if (shouldFloat && !isFloating && !userDismissedFloat) {
        isFloating = true;
        placeholder.style.display = "block";
        container.style.position = "fixed";

        closeBtn.style.display = "flex";

        if (isMobile) {
          container.style.top = STICKY_TOP + "px";
          container.style.left = "50%";
          container.style.transform = "translateX(-50%)";
        } else {
          container.style.bottom = STICKY_BOTTOM + "px";
          container.style.right = "12px";
          container.style.transform = "scale(0.5)";
          container.style.transformOrigin = "bottom right";
        }

        container.style.margin = "0";
      }

      if (!shouldFloat && isFloating) {
        returnToInline();
      }
    });
  });

  function findEuropeanMarketsRow() {
    if (!IS_GLOBAL_INDICES_PAGE) return null;

    const spans = document.querySelectorAll("span");

    for (const sp of spans) {
      if (!sp.textContent) continue;

      const text = sp.textContent.trim().toUpperCase();

      if (text === "EUROPEAN MARKETS" || text.includes("EUROPEAN MARKETS")) {
        const tr = sp.closest("tr");
        if (tr) return tr;
      }
    }

    return null;
  }

  // Same placement logic as before; now returns a label of where the player went.
  function injectInArticle() {
    const targetId = isMobile ? "osv_player_wap" : "osv_player_web";
    const targetDiv = doc.getElementById(targetId);

    if (targetDiv) {
      targetDiv.innerHTML = "";
      targetDiv.appendChild(container);
      return targetId;
    }

    const euRow = findEuropeanMarketsRow();
    if (euRow) {
      euRow.after(container);
      return "eu_markets_row";
    }

    const prioritySelectors = [
      "#top_screen_news_mobile",
      ".prostocklist-tab-contents",
      ".market_bx",
      "#startup-videos-main",
      "#mainprice",
      ".sec_indice_detail"
    ];

    for (let selector of prioritySelectors) {
      const el = doc.querySelector(selector);
      if (el && el.offsetParent !== null) {
        el.after(container);
        return selector;
      }
    }

    const h1 = doc.querySelector("h1");
    if (!h1) {
      doc.body.appendChild(container);
      return "body_end_no_h1";
    }

    const paras = Array.from(doc.querySelectorAll("p"))
      .filter(p => h1.compareDocumentPosition(p) & Node.DOCUMENT_POSITION_FOLLOWING);

    (paras[INSERT_AFTER_P - 1] || paras[paras.length - 1] || h1)
      .after(container);

    if (paras[INSERT_AFTER_P - 1]) return "after_p" + INSERT_AFTER_P;
    return paras.length ? "after_last_p" : "after_h1";
  }

  const osvPlacement = injectInArticle();
  container.after(placeholder);

  try {
    const r = container.getBoundingClientRect();
    const docY = r.top + (window.scrollY || 0);
    const vh = window.innerHeight || 1;
    OSV.reach("player_created");
    OSV.send("osv_player_created", {
      placement: osvPlacement,
      is_rendered: (container.offsetParent !== null && r.width > 0 && r.height > 0) ? 1 : 0,
      player_y: Math.round(docY / 250) * 250,
      screens_down: Math.round((docY / vh) * 10) / 10,
      viewport_h: Math.round(vh),
      ms_since_exec: OSV.sinceExec()
    });
  } catch (e) {}

  const video = container.querySelector("#mc-video");
  const adLayer = container.querySelector("#mc-ad-layer");
  const closeBtn = container.querySelector("#mc-close");
  const muteBtn  = container.querySelector("#mc-mute");
  const thumbnail = container.querySelector("#mc-thumb");
  adLayer.style.pointerEvents = "none";

  let hlsInstance = null;

  const DEFAULT_VIDEO_DURATION = 900;

  video.preload = "metadata";

  function ensureHlsReady() {
    if (!CONTENT_VIDEO.includes(".m3u8")) return Promise.resolve();
    if (video.canPlayType("application/vnd.apple.mpegurl")) return Promise.resolve();
    if (window.Hls && window.Hls.isSupported()) return Promise.resolve();

    if (hlsReady) return hlsReady;

    hlsReady = new Promise((resolve, reject) => {
      const existing = document.querySelector('script[data-mc-hls="1"]');

      if (existing) {
        existing.addEventListener("load", resolve, { once: true });
        existing.addEventListener("error", reject, { once: true });
        return;
      }

      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/hls.js@latest";
      script.async = true;
      script.dataset.mcHls = "1";
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });

    return hlsReady;
  }

  function ensureIMAReady() {
    if (window.google && window.google.ima) return Promise.resolve();
    if (imaReady) return imaReady;

    imaReady = new Promise((resolve, reject) => {
      const existing = document.querySelector('script[data-mc-ima="1"]');

      if (existing) {
        existing.addEventListener("load", resolve, { once: true });
        existing.addEventListener("error", reject, { once: true });
        return;
      }

      const script = document.createElement("script");
      script.src = "https://imasdk.googleapis.com/js/sdkloader/ima3.js";
      script.async = true;
      script.dataset.mcIma = "1";
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });

    return imaReady;
  }

  function loadContentVideo() {
    if (!CONTENT_VIDEO.includes(".m3u8")) {
      video.src = CONTENT_VIDEO;
      video.load();
      return;
    }

    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = CONTENT_VIDEO;
      video.load();
      return;
    }

    ensureHlsReady()
      .then(osvGuard("hls_init", () => {
        if (!window.Hls || !window.Hls.isSupported()) return;

        if (hlsInstance) {
          hlsInstance.destroy();
        }

        hlsInstance = new Hls({
          enableWorker: true,
          lowLatencyMode: false,
          maxBufferLength: 30,
          maxMaxBufferLength: 60,
          startLevel: -1,
          abrEwmaDefaultEstimate: 500000,
          capLevelToPlayerSize: true
        });

        try {
          hlsInstance.on(Hls.Events.ERROR, (evt, data) => {
            if (!data || !data.fatal) return;
            OSV.send("osv_content_error", {
              source: "hls",
              hls_type: String(data.type || "").slice(0, 40),
              hls_details: String(data.details || "").slice(0, 60),
              ad_playing: adPlaying ? 1 : 0
            });
          });
        } catch (e) {}

        hlsInstance.loadSource(CONTENT_VIDEO);
        hlsInstance.attachMedia(video);
      }))
      .catch(() => {
        OSV.send("osv_content_error", { source: "hlsjs_load_failed" });
        console.warn("[MC Outstream] HLS.js failed to load.");
      });
  }

  if (CONTENT_VIDEO.includes(".m3u8")) {
    const preloadLink = document.createElement("link");
    preloadLink.rel = "preload";
    preloadLink.as = "fetch";
    preloadLink.href = CONTENT_VIDEO;
    preloadLink.crossOrigin = "anonymous";
    document.head.appendChild(preloadLink);

    ensureHlsReady().catch(() => {});
  }
  ensureIMAReady().catch(() => {});

  loadContentVideo();
  video.loop = false;
  video.muted = true;
  video.setAttribute("muted", "");
  video.setAttribute("playsinline", "");

  function getVPMute() { return video.muted ? 1 : 0; }

  function getVideoDurationForAds() {
    return Number.isFinite(video.duration) && video.duration > 0
      ? Math.floor(video.duration)
      : DEFAULT_VIDEO_DURATION;
  }

  function osvSinceRequest(ctx) {
    return (ctx && ctx.t0 !== undefined) ? osvNow() - ctx.t0 : undefined;
  }

  function osvTrackImaError(e, phase, fallbackCtx) {
    let ctx = fallbackCtx || {};
    try {
      const c = e && e.getUserRequestContext && e.getUserRequestContext();
      if (c && c.reqId) ctx = c;
    } catch (x) {}
    let err = null;
    try { err = e.getError(); } catch (x) {}
    let code, vastCode, type, msg;
    try { code = err.getErrorCode(); } catch (x) {}
    try { vastCode = err.getVastErrorCode(); } catch (x) {}
    try { type = err.getType(); } catch (x) {}
    try { msg = String(err.getMessage() || "").slice(0, 100); } catch (x) {}
    OSV.n.ima_errors++;
    OSV.send("osv_ima_error", {
      phase: phase,
      slot: ctx.slot,
      unit: ctx.unit,
      req_id: ctx.reqId,
      error_code: code,
      vast_code: vastCode,
      error_type: type,
      error_msg: msg,
      is_stale: (ctx.reqId && ctx.reqId !== osvLatestReqId) ? 1 : 0,
      ms_since_request: osvSinceRequest(ctx)
    });
  }

  function startAdsIfViewable() {
    if (!viewable || !adsManagerReady || adsStarted || playerKilled) return;
    try {
      adsStarted = true;
      adsManager.init(WIDTH, HEIGHT, google.ima.ViewMode.NORMAL);
      adsManager.start();
    } catch (e) {
      OSV.send("osv_ad_start_failed", {
        slot: osvLatestCtx.slot,
        unit: osvLatestCtx.unit,
        req_id: osvLatestCtx.reqId,
        error_msg: String((e && e.message) || e).slice(0, 100)
      });
      adsStarted = false;
      tryNextVast(isPreroll);
    }
  }

  function clearPrerollTimer() {
    if (!prerollTimer) return;
    clearTimeout(prerollTimer);
    prerollTimer = null;
  }

  function startPrerollTimer() {
    clearPrerollTimer();
    prerollTimer = setTimeout(osvGuard("preroll_timer", () => {
      if (!isPreroll || adPlaying || adsManagerReady) return;
      OSV.n.timeouts++;
      OSV.send("osv_vast_timeout", {
        slot: osvLatestCtx.slot,
        unit: osvLatestCtx.unit,
        req_id: osvLatestCtx.reqId,
        ms_since_request: osvSinceRequest(osvLatestCtx)
      });
      tryNextVast(true);
    }), PREROLL_TIMEOUT_MS);
  }

  function requestPrerollIfNeeded() {
    if (prerollRequested || !adsLoader || !isPreroll) return;
    prerollRequested = true;
    requestAds(false);
  }

  function requestAds(isMidroll) {
    if (playerKilled) return;

    adsManagerReady = false;

    const req = new google.ima.AdsRequest();
    const waterfall = isMidroll ? MIDROLL_WATERFALL : PREROLL_WATERFALL;
    const index = isMidroll ? midrollIndex : prerollIndex;
    const PAGE_URL = encodeURIComponent(window.location.href);

    if (!waterfall[index]) return;

    req.adTagUrl = waterfall[index]
      + "&description_url=" + PAGE_URL
      + "&vid_t=" + encodeURIComponent(document.title)
      + "&vid_kw=" + encodeURIComponent("stock market, investing, finance, crude oil price, gold price, rupees, sensex, bse, share market")
      + "&vid_d=" + getVideoDurationForAds()
      + "&vpmute=" + getVPMute()
      + "&cust_params=" + encodeURIComponent("category=finance" + "&section=markets" + "&content=stocks" + "&format=video" + "&lang=en" + "&ptype=outstream" + "&plcmt=sticky")
      + "&correlator=" + Date.now();

    req.linearAdSlotWidth = WIDTH;
    req.linearAdSlotHeight = HEIGHT;
    req.setAdWillAutoPlay(true);
    req.setAdWillPlayMuted(video.muted);
    req.plcmt = 2;

    // --- tracking: request context travels with the request through IMA ---
    const unitNo = (isMidroll ? 4 : 1) + index;
    const osvCtx = {
      reqId: ++osvReqSeq,
      slot: isMidroll ? "midroll" : "preroll",
      unit: unitNo,
      t0: osvNow()
    };
    osvLatestReqId = osvCtx.reqId;
    osvLatestCtx = osvCtx;
    OSV.n.requests++;
    OSV.reach("vast_requested");
    OSV.send("osv_vast_request", {
      slot: osvCtx.slot,
      unit: unitNo,
      ad_unit: "Inhouse_Video_1_" + unitNo,
      req_id: osvCtx.reqId,
      viewable: viewable ? 1 : 0,
      ms_since_exec: OSV.sinceExec()
    });

    if (!isMidroll) startPrerollTimer();
    adsLoader.requestAds(req, osvCtx);
  }

  function tryNextVast(isPrerollContext) {
    clearPrerollTimer();

    if (adsManager) { try { adsManager.destroy(); } catch (e) {} }
    adsManager = null;
    adsManagerReady = false;
    adsStarted = false;
    adPlaying = false;

    if (isPrerollContext) {
      prerollIndex++;
      prerollRequested = false;

      if (prerollIndex < PREROLL_WATERFALL.length) {
        requestPrerollIfNeeded();
      } else {
        OSV.send("osv_waterfall_exhausted", { slot: "preroll" });
        isPreroll = false;
        video.play().catch(() => {});
      }
    } else {
      midrollIndex++;
      midrollPlaying = false;
      if (midrollIndex < MIDROLL_WATERFALL.length) {
        requestAds(true);
      } else {
        OSV.send("osv_waterfall_exhausted", { slot: "midroll" });
        midrollIndex = 0;
        video.play().catch(() => {});
      }
    }
  }

  let osvRafDelay;

  function initIMA() {
    adc = new google.ima.AdDisplayContainer(adLayer, video);
    adsLoader = new google.ima.AdsLoader(adc);
    adsLoader.addEventListener(google.ima.AdsManagerLoadedEvent.Type.ADS_MANAGER_LOADED, osvGuard("ads_manager_loaded", onAdsManagerLoaded));
    adsLoader.addEventListener(google.ima.AdErrorEvent.Type.AD_ERROR, osvGuard("ads_loader_error", (e) => {
      osvTrackImaError(e, "load", null);
      tryNextVast(isPreroll);
    }));
    adc.initialize();

    OSV.reach("ima_ready");
    OSV.send("osv_ima_ready", {
      raf_delay_ms: osvRafDelay,
      ms_since_exec: OSV.sinceExec(),
      ima_version: (google.ima.VERSION ? String(google.ima.VERSION).slice(0, 20) : undefined)
    });

    requestPrerollIfNeeded();
  }

  function loadIMA() {
    ensureIMAReady()
      .then(osvGuard("init_ima", initIMA))
      .catch((err) => {
        OSV.flags.ima_failed = 1;
        OSV.send("osv_ima_sdk_failed", {
          cause: (err && err.type === "error") ? "script_load_blocked_or_failed" : "init_exception",
          error_msg: String((err && err.message) || (err && err.type) || err || "").slice(0, 100),
          ms_since_exec: OSV.sinceExec()
        });
        console.warn("[MC Outstream] IMA SDK failed to load. Falling back to content.");
        if (hlsInstance) {
          hlsInstance.destroy();
          hlsInstance = null;
        }
        isPreroll = false;
        clearPrerollTimer();
        video.play().catch(() => {});
      });
  }

  // rAF never fires in hidden/background tabs: raf_delay_ms on osv_ima_ready shows the impact.
  const osvRafQueuedAt = osvNow();
  requestAnimationFrame(osvGuard("raf_load_ima", () => {
    osvRafDelay = osvNow() - osvRafQueuedAt;
    loadIMA();
  }));

  const prefetchObserver = new IntersectionObserver(osvGuard("io_prefetch", entries => {
    const entry = entries[0];
    if (!entry.isIntersecting) return;

    if (!OSV.flags.near_vp) {
      OSV.flags.near_vp = 1;
      OSV.send("osv_near_viewport", {
        ms_since_exec: OSV.sinceExec(),
        preroll_requested: prerollRequested ? 1 : 0,
        ima_ready: adsLoader ? 1 : 0
      });
    }

    requestPrerollIfNeeded();
    prefetchObserver.disconnect();
  }), {
    root: null,
    rootMargin: PREROLL_PREFETCH_MARGIN,  // "400px 0px"
    threshold: 0.01
  });

  prefetchObserver.observe(container);

  const observer = new IntersectionObserver(osvGuard("io_view", entries => {
    const entry = entries[0];
    viewable = entry.intersectionRatio >= 0.1;

    if (viewable && !OSV.flags.in_view) {
      OSV.flags.in_view = 1;
      OSV.send("osv_player_view", {
        ms_since_exec: OSV.sinceExec(),
        ima_ready: adsLoader ? 1 : 0,
        preroll_requested: prerollRequested ? 1 : 0,
        ads_ready: adsManagerReady ? 1 : 0,
        ad_playing: adPlaying ? 1 : 0,
        is_preroll: isPreroll ? 1 : 0
      });
    }

    if (viewable && adsManagerReady && !playerKilled) startAdsIfViewable();

    if (!adPlaying && !isPreroll) {
      if (viewable) {
        video.play().catch(() => {});
      } else if (!isFloating) {
        video.pause();
      }
    }
  }), { threshold: 0.1 });

  observer.observe(container);

  const ppOverlay = container.querySelector("#mc-playpause-overlay");
  const ppIcon    = container.querySelector("#mc-pp-icon");

  const ICON_PAUSE = `<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>`;
  const ICON_PLAY  = `<path d="M8 5v14l11-7z"/>`;

  function syncPPIcon() {
    if (!ppIcon) return;
    ppIcon.innerHTML = video.paused ? ICON_PLAY : ICON_PAUSE;
  }

  if (ppOverlay) {
    ppOverlay.addEventListener("click", () => {
      if (adPlaying || isPreroll || playerKilled) return;
      ppOverlay.classList.remove("mc-flash");
      void ppOverlay.offsetWidth;
      ppOverlay.classList.add("mc-flash");

      if (video.paused) { video.play().catch(() => {}); }
      else              { video.pause(); }
    });
  }

  video.addEventListener("pause",   syncPPIcon);
  video.addEventListener("playing", syncPPIcon);

  video.addEventListener("playing", () => {
    if (thumbnail) thumbnail.style.display = "none";
    video.style.opacity = 1;
    muteBtn.style.display = "flex";
  });

  // Content tracking (first content play only; on iOS IMA may play ads in this element).
  video.addEventListener("playing", () => {
    if (OSV.flags.content_played || adPlaying) return;
    OSV.flags.content_played = 1;
    OSV.send("osv_content_play", {
      ms_since_exec: OSV.sinceExec(),
      after_preroll: isPreroll ? 0 : 1,
      viewable: viewable ? 1 : 0
    });
  });

  video.addEventListener("error", () => {
    const me = video.error;
    OSV.send("osv_content_error", {
      source: "video_element",
      media_error_code: me ? me.code : undefined,
      error_msg: me && me.message ? String(me.message).slice(0, 100) : undefined,
      ad_playing: adPlaying ? 1 : 0
    });
  });

  function onAdsManagerLoaded(e) {
    let osvCtx = {};
    try { osvCtx = e.getUserRequestContext() || {}; } catch (x) {}
    OSV.n.loaded++;
    OSV.reach("ads_loaded");
    OSV.send("osv_ima_ads_loaded", {
      slot: osvCtx.slot,
      unit: osvCtx.unit,
      req_id: osvCtx.reqId,
      latency_ms: osvSinceRequest(osvCtx),
      viewable: viewable ? 1 : 0,
      is_stale: (osvCtx.reqId && osvCtx.reqId !== osvLatestReqId) ? 1 : 0   // arrived after a newer request was issued
    });

    clearPrerollTimer();

    adsManager = e.getAdsManager(video);
    adsManager.setVolume(video.muted ? 0 : 1);

    adsManager.addEventListener(google.ima.AdErrorEvent.Type.AD_ERROR, osvGuard("ads_manager_error", (ev) => {
      osvTrackImaError(ev, "playback", osvCtx);
      tryNextVast(isPreroll);
    }));

    adsManager.addEventListener(google.ima.AdEvent.Type.STARTED, osvGuard("ad_started", (ev) => {
      adPlaying = true;
      container.setAttribute("data-ad-playing", "true");
      if (thumbnail) thumbnail.style.display = "none";
      muteBtn.style.display = "flex";
      video.pause();
      adLayer.style.pointerEvents = "auto";

      try {
        let ad = null;
        try { ad = ev.getAd(); } catch (x) {}
        OSV.reach("ad_started");
        OSV.send("osv_ad_started", {
          slot: osvCtx.slot,
          unit: osvCtx.unit,
          req_id: osvCtx.reqId,
          ms_since_request: osvSinceRequest(osvCtx),
          ad_system: ad && ad.getAdSystem ? String(ad.getAdSystem() || "").slice(0, 40) : undefined,
          ad_duration_s: ad && ad.getDuration ? Math.round(ad.getDuration()) : undefined
        });
      } catch (x) {}
    }));

    adsManager.addEventListener(google.ima.AdEvent.Type.IMPRESSION, () => {
      OSV.n.impressions++;
      OSV.reach("ad_impression");
      OSV.send("osv_ad_impression", {
        slot: osvCtx.slot,
        unit: osvCtx.unit,
        req_id: osvCtx.reqId,
        ms_since_request: osvSinceRequest(osvCtx),
        ms_since_exec: OSV.sinceExec()
      });
    });

    adsManager.addEventListener(google.ima.AdEvent.Type.ALL_ADS_COMPLETED, osvGuard("all_ads_completed", () => {
      OSV.send("osv_ad_completed", { slot: osvCtx.slot, unit: osvCtx.unit, req_id: osvCtx.reqId });

      adPlaying = false;
      container.removeAttribute("data-ad-playing");
      adLayer.style.pointerEvents = "none";
      adsStarted = false;

      if (isPreroll) {
        prerollIndex++;
        prerollRequested = false;

        if (prerollIndex < PREROLL_WATERFALL.length) {
          requestPrerollIfNeeded();
        } else {
          isPreroll = false;
          video.play().catch(() => {});
        }
      } else {
        midrollIndex++;
        if (midrollIndex < MIDROLL_WATERFALL.length) {
          requestAds(true);
        } else {
          midrollIndex = 0;
          video.play().catch(() => {});
        }
        midrollPlaying = false;
      }
    }));

    adsManagerReady = true;
    setTimeout(osvGuard("start_ads", () => startAdsIfViewable()), 0);
  }

  video.addEventListener("ended", () => {
    if (adsLoader) {
      try { adsLoader.contentComplete(); } catch (e) {}
    }
  });

  video.addEventListener("timeupdate", osvGuard("timeupdate", () => {
    if (video.currentTime < lastMidrollTime) lastMidrollTime = 0;
    if (playerKilled || midrollPlaying || isPreroll || !viewable) return;
    if (video.currentTime - lastMidrollTime >= MIDROLL_INTERVAL) {
      lastMidrollTime = video.currentTime;
      midrollPlaying = true;
      requestAds(true);
    }
  }));

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) video.pause();
    else if (!adPlaying && !isPreroll && viewable) video.play().catch(() => {});
  });

  const MUTE_ICON_OFF = `<svg id="mc-mute-icon" xmlns="http://www.w3.org/2000/svg" width="${isMobile ? 17 : 20}" height="${isMobile ? 17 : 20}" fill="white" viewBox="0 0 24 24"><path d="M16.5 12A4.5 4.5 0 0014 7.97v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51A8.796 8.796 0 0021 12c0-4.28-3-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06a8.99 8.99 0 003.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>`;
  const MUTE_ICON_ON  = `<svg id="mc-mute-icon" xmlns="http://www.w3.org/2000/svg" width="${isMobile ? 17 : 20}" height="${isMobile ? 17 : 20}" fill="white" viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0014 7.97v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77 0-4.28-2.99-7.86-7-8.77z"/></svg>`;

  muteBtn.onclick = () => {
    const m = !video.muted;
    video.muted = m;
    if (adsManager) adsManager.setVolume(m ? 0 : 1);
    muteBtn.innerHTML = m ? MUTE_ICON_OFF : MUTE_ICON_ON;
  };

  closeBtn.onclick = () => {
    userDismissedFloat = true;
    returnToInline();
    if (!adPlaying) video.pause();
  };

  } catch (osvInitErr) {
    // Synchronous failure while building the player (e.g. Element.after or
    // IntersectionObserver missing on an old browser). Report, then rethrow.
    osvReportError(osvInitErr, "init", "js");
    throw osvInitErr;
  }

})();
