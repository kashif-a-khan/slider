(function () {

  if (window.__MC_OUTSTREAM_LOADED__) return;
  window.__MC_OUTSTREAM_LOADED__ = true;

  const doc = document;
  const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
  const IS_GLOBAL_INDICES_PAGE = location.pathname.toLowerCase().includes("/markets/global-indices/");

  const WIDTH  = isMobile ? 340 : 512;
  const HEIGHT = isMobile ? 190 : 288;

  const INSERT_AFTER_P = 3;
  const MIDROLL_INTERVAL = 15;
  const ENABLE_STICKY = false;

  const STICKY_BOTTOM = isMobile ? 110 : 12;
  const STICKY_TOP = 50;

  const BTN_SIZE = isMobile ? 40 : 50;
  const BTN_LEFT_MARGIN = isMobile ? 5 : 0;

  const CONTENT_VIDEO = "https://media-moneycontrol.akamaized.net/13542031/manifest.m3u8";
  const THUMBNAIL_URL = "https://images.moneycontrol.com/images/2019/english/inters_logo.jpg";

  const PREROLL_WATERFALL = [
    "https://pubads.g.doubleclick.net/gampad/ads?iu=/1039154/Inhouse_Video_1_3&description_url=https%3A%2F%2Fwww.moneycontrol.com&tfcd=0&npa=0&sz=400x300%7C640x360%7C640x480&gdfp_req=1&unviewed_position_start=1&output=vast&env=vp&vpos=preroll&impl=s&plcmt=1&vpw=640&vph=360",
    "https://pubads.g.doubleclick.net/gampad/ads?iu=/1039154/Inhouse_Video_1_3&description_url=https%3A%2F%2Fwww.moneycontrol.com&tfcd=0&npa=0&sz=400x300%7C640x360%7C640x480&gdfp_req=1&unviewed_position_start=1&output=vast&env=vp&vpos=preroll&impl=s&plcmt=1&vpw=640&vph=360",
    "https://pubads.g.doubleclick.net/gampad/ads?iu=/1039154/Inhouse_Video_1_3&description_url=https%3A%2F%2Fwww.moneycontrol.com&tfcd=0&npa=0&sz=400x300%7C640x360%7C640x480&gdfp_req=1&unviewed_position_start=1&output=vast&env=vp&vpos=preroll&impl=s&plcmt=1&vpw=640&vph=360"
  ];
  const MIDROLL_WATERFALL = [
    "https://pubads.g.doubleclick.net/gampad/ads?iu=/1039154/Inhouse_Video_1_4&description_url=https%3A%2F%2Fwww.moneycontrol.com&tfcd=0&npa=0&sz=400x300%7C640x360%7C640x480&gdfp_req=1&unviewed_position_start=1&output=vast&env=vp&vpos=midroll&impl=s&plcmt=1&vpw=640&vph=360",
    "https://pubads.g.doubleclick.net/gampad/ads?iu=/1039154/Inhouse_Video_1_4&description_url=https%3A%2F%2Fwww.moneycontrol.com&tfcd=0&npa=0&sz=400x300%7C640x360%7C640x480&gdfp_req=1&unviewed_position_start=1&output=vast&env=vp&vpos=midroll&impl=s&plcmt=1&vpw=640&vph=360",
    "https://pubads.g.doubleclick.net/gampad/ads?iu=/1039154/Inhouse_Video_1_4&description_url=https%3A%2F%2Fwww.moneycontrol.com&tfcd=0&npa=0&sz=400x300%7C640x360%7C640x480&gdfp_req=1&unviewed_position_start=1&output=vast&env=vp&vpos=midroll&impl=s&plcmt=1&vpw=640&vph=360"
  ];

  let prerollIndex = 0;
  let midrollIndex = 0;

  let adsLoader = null, adsManager = null, adc = null;
  let lastMidrollTime = 0, midrollPlaying = false, adPlaying = false, playerKilled = false, isPreroll = true;
  let viewable = false, adsManagerReady = false;

  let isFloating = false;
  let cachedInlineTop = null;

  // Once the user closes the floating player, never float again for this page load.
  let userDismissedFloat = false;

  let hlsScriptLoading = false;

  const container = doc.createElement("div");
  container.id = "mc-outstream-player";
  container.style.cssText = `
    width:${WIDTH}px;
    height:${HEIGHT}px;
    background:#000;
    margin:${isMobile ? "15px auto 20px auto" : "15px auto"};
    position:relative;
    z-index:999999;
    opacity:1;
    visibility:visible;
    pointer-events:auto;
  `;

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

  // ─── returnToInline: collapses float without killing the player ───────────────
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

  // ─── Scroll handler: throttled via rAF ───────────────────────────────────────
  let scrollRafPending = false;

  window.addEventListener("scroll", () => {
    if (!ENABLE_STICKY || scrollRafPending) return;
    scrollRafPending = true;

    requestAnimationFrame(() => {
      scrollRafPending = false;

      const y = window.scrollY;
      const inlineTop = getInlineTop();
      const shouldFloat = y > inlineTop + 300;

      // If user has dismissed the float, never re-float.
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

  function injectInArticle() {
    const targetId = isMobile ? "osv_player_wap" : "osv_player_web";
    const targetDiv = doc.getElementById(targetId);

    if (targetDiv) {
      targetDiv.innerHTML = "";
      targetDiv.appendChild(container);
      return;
    }

    const euRow = findEuropeanMarketsRow();
    if (euRow) {
      euRow.after(container);
      return;
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
        return;
      }
    }

    const h1 = doc.querySelector("h1");
    if (!h1) {
      doc.body.appendChild(container);
      return;
    }

    const paras = Array.from(doc.querySelectorAll("p"))
      .filter(p => h1.compareDocumentPosition(p) & Node.DOCUMENT_POSITION_FOLLOWING);

    (paras[INSERT_AFTER_P - 1] || paras[paras.length - 1] || h1)
      .after(container);
  }

  injectInArticle();
  container.after(placeholder);

  const video = container.querySelector("#mc-video");
  const adLayer = container.querySelector("#mc-ad-layer");
  const closeBtn = container.querySelector("#mc-close");
  const muteBtn  = container.querySelector("#mc-mute");
  const thumbnail = container.querySelector("#mc-thumb");
  adLayer.style.pointerEvents = "none";

  let hlsInstance = null;

  function loadContentVideo() {
    if (!CONTENT_VIDEO.includes(".m3u8")) { video.src = CONTENT_VIDEO; return; }
    if (video.canPlayType('application/vnd.apple.mpegurl')) { video.src = CONTENT_VIDEO; return; }

    if (hlsScriptLoading) return;
    hlsScriptLoading = true;

    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/hls.js@latest";
    script.onload = function () {
      if (!window.Hls || !Hls.isSupported()) return;
      hlsInstance = new Hls({ enableWorker: true, lowLatencyMode: true, backBufferLength: 30 });
      hlsInstance.loadSource(CONTENT_VIDEO);
      hlsInstance.attachMedia(video);
    };
    script.onerror = function () {
      console.warn("[MC Outstream] HLS.js failed to load.");
      hlsScriptLoading = false;
    };
    document.head.appendChild(script);
  }

  loadContentVideo();
  video.loop = false; video.muted = true;
  video.setAttribute("muted", ""); video.setAttribute("playsinline", "");

  function getVPMute() { return video.muted ? 1 : 0; }

  function startAdsIfViewable() {
    if (!viewable || !adsManagerReady || playerKilled) return;
    try { adsManager.init(WIDTH, HEIGHT, google.ima.ViewMode.NORMAL); adsManager.start(); } catch (e) {}
  }

  function requestAds(isMidroll) {
    if (playerKilled) return;

    adsManagerReady = false;

    const req = new google.ima.AdsRequest();
    const waterfall = isMidroll ? MIDROLL_WATERFALL : PREROLL_WATERFALL;
    const index = isMidroll ? midrollIndex : prerollIndex;

    if (!waterfall[index]) return;

    req.adTagUrl = waterfall[index] + "&vpmute=" + getVPMute() + "&correlator=" + Date.now();
    req.linearAdSlotWidth = WIDTH;
    req.linearAdSlotHeight = HEIGHT;
    req.setAdWillAutoPlay(true);
    req.plcmt = 1;

    adsLoader.requestAds(req);
  }

  function tryNextVast(isPrerollContext) {
    if (adsManager) { try { adsManager.destroy(); } catch (e) {} }
    adsManager = null;
    midrollPlaying = false;
    adPlaying = false;

    if (isPrerollContext) {
      prerollIndex++;
      if (prerollIndex < PREROLL_WATERFALL.length) requestAds(false);
      else {
        isPreroll = false;
        video.play().catch(() => {});
      }
    } else {
      midrollIndex++;
      if (midrollIndex < MIDROLL_WATERFALL.length) requestAds(true);
      else {
        midrollIndex = 0;
        video.play().catch(() => {});
      }
    }
  }

  function initIMA() {
    adc = new google.ima.AdDisplayContainer(adLayer, video);
    adsLoader = new google.ima.AdsLoader(adc);
    adsLoader.addEventListener(google.ima.AdsManagerLoadedEvent.Type.ADS_MANAGER_LOADED, onAdsManagerLoaded);
    adsLoader.addEventListener(google.ima.AdErrorEvent.Type.AD_ERROR, () => tryNextVast(isPreroll));
    adc.initialize();
    requestAds(false);
  }

  function loadIMA() {
    if (window.google && window.google.ima) { initIMA(); return; }

    const s = doc.createElement("script");
    s.src = "https://imasdk.googleapis.com/js/sdkloader/ima3.js";
    s.onload = initIMA;
    s.onerror = function () {
      console.warn("[MC Outstream] IMA SDK failed to load. Falling back to content.");
      isPreroll = false;
      video.play().catch(() => {});
    };
    doc.head.appendChild(s);
  }

  loadIMA();

  // ─── IntersectionObserver: pause only when inline and out of view ─────────────
  // When floating, the player manages its own playback — don't pause it just
  // because the inline position has scrolled out of the viewport.
  const observer = new IntersectionObserver(entries => {
    const entry = entries[0];
    viewable = entry.intersectionRatio >= 0.1;

    if (viewable && adsManagerReady && !playerKilled) startAdsIfViewable();

    if (!adPlaying && !isPreroll) {
      if (viewable) {
        video.play().catch(() => {});
      } else if (!isFloating) {
        // Only pause when inline and scrolled out of view, not when floating.
        video.pause();
      }
    }
  }, { threshold: 0.1 });

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

  function onAdsManagerLoaded(e) {
    adsManager = e.getAdsManager(video);
    adsManager.setVolume(video.muted ? 0 : 1);

    adsManager.addEventListener(google.ima.AdEvent.Type.STARTED, () => {
      adPlaying = true;
      container.setAttribute("data-ad-playing", "true");
      if (thumbnail) thumbnail.style.display = "none";
      muteBtn.style.display = "flex";
      video.pause();
      adLayer.style.pointerEvents = "auto";
    });

    adsManager.addEventListener(google.ima.AdEvent.Type.ALL_ADS_COMPLETED, () => {
      adPlaying = false;
      container.removeAttribute("data-ad-playing");
      adLayer.style.pointerEvents = "none";
      adsLoader.contentComplete();

      if (isPreroll) {
        prerollIndex++;
        if (prerollIndex < PREROLL_WATERFALL.length) {
          requestAds(false);
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
    });

    adsManagerReady = true;
    startAdsIfViewable();
  }

  video.addEventListener("timeupdate", () => {
    if (video.currentTime < lastMidrollTime) lastMidrollTime = 0;
    if (playerKilled || midrollPlaying || isPreroll || !viewable) return;
    if (video.currentTime - lastMidrollTime >= MIDROLL_INTERVAL) {
      lastMidrollTime = video.currentTime;
      midrollPlaying = true;
      requestAds(true);
    }
  });

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

  // ─── Close button: snap back to inline, never float again ────────────────────
  closeBtn.onclick = () => {
    userDismissedFloat = true;
    returnToInline();
    if (!adPlaying) video.pause();
  };

})();
