(function () {

  if (window.__MC_OUTSTREAM__) return;
  window.__MC_OUTSTREAM__ = true;

  const doc = document;

  /* ================= CONFIG ================= */

  const CONFIG = {
    width: 340,
    height: 190,
    insertAfterParagraph: 2,
    midrollInterval: 15, // seconds
    contentVideo: "https://www.w3schools.com/html/mov_bbb.mp4",
    prerollTag: "https://pubads.g.doubleclick.net/gampad/ads?iu=/1039154/Inhouse_Video_1_3&output=vast&env=vp&impl=s&plcmt=1&vpos=preroll",
    midrollTag: "https://pubads.g.doubleclick.net/gampad/ads?iu=/1039154/Inhouse_Video_1_4&output=vast&env=vp&impl=s&plcmt=1&vpos=midroll",
    viewabilityThreshold: 0.5
  };

  /* ================= STATE ================= */

  let adsLoader = null;
  let adsManager = null;
  let adDisplayContainer = null;

  let isViewable = false;
  let adPlaying = false;
  let midrollPending = false;
  let playerDestroyed = false;
  let isPreroll = true;

  let watchTime = 0;
  let lastWatchTick = Date.now();

  /* ================= UI ================= */

  const container = doc.createElement("div");
  container.style.cssText = `
    width:${CONFIG.width}px;
    height:${CONFIG.height}px;
    background:#000;
    margin:20px auto;
    position:relative;
    opacity:0;
    visibility:hidden;
  `;

  container.innerHTML = `
    <video playsinline muted style="width:100%;height:100%;background:#000"></video>
    <div style="position:absolute;top:0;left:0;width:100%;height:100%;z-index:10;"></div>
    <button style="position:absolute;top:6px;left:6px;">×</button>
    <button style="position:absolute;bottom:6px;left:6px;">🔇</button>
  `;

  /* ================= ARTICLE INJECTION ================= */

  function inject() {
    const p = doc.querySelectorAll("p");
    if (p.length >= CONFIG.insertAfterParagraph) {
      p[CONFIG.insertAfterParagraph - 1].after(container);
    } else {
      doc.body.appendChild(container);
    }
  }

  inject();

  const video = container.querySelector("video");
  const adLayer = container.children[1];
  const closeBtn = container.children[2];
  const muteBtn = container.children[3];

  video.src = CONFIG.contentVideo;
  video.loop = true;
  video.muted = true;

  video.addEventListener("playing", () => {
    container.style.opacity = "1";
    container.style.visibility = "visible";
  });

  /* ================= IMA LOAD ================= */

  function loadIMA() {
    if (window.google && google.ima) return initIMA();

    const s = doc.createElement("script");
    s.src = "https://imasdk.googleapis.com/js/sdkloader/ima3.js";
    s.onload = initIMA;
    doc.head.appendChild(s);
  }

  function initIMA() {

    adDisplayContainer = new google.ima.AdDisplayContainer(adLayer, video);
    adsLoader = new google.ima.AdsLoader(adDisplayContainer);

    adsLoader.addEventListener(
      google.ima.AdsManagerLoadedEvent.Type.ADS_MANAGER_LOADED,
      onAdsManagerLoaded
    );

    adsLoader.addEventListener(
      google.ima.AdErrorEvent.Type.AD_ERROR,
      onAdError
    );

    adDisplayContainer.initialize();
    requestAds(false);
  }

  function requestAds(isMidroll) {

    if (playerDestroyed) return;

    const request = new google.ima.AdsRequest();
    const base = isMidroll ? CONFIG.midrollTag : CONFIG.prerollTag;

    request.adTagUrl = base + "&correlator=" + Date.now();
    request.linearAdSlotWidth = CONFIG.width;
    request.linearAdSlotHeight = CONFIG.height;
    request.setAdWillAutoPlay(true);
    request.setAdWillPlayMuted(true);

    adsLoader.requestAds(request);
  }

  function onAdsManagerLoaded(event) {

    adsManager = event.getAdsManager(video);

    adsManager.addEventListener(
      google.ima.AdEvent.Type.STARTED,
      () => {
        adPlaying = true;
        video.pause();
      }
    );

    adsManager.addEventListener(
      google.ima.AdEvent.Type.ALL_ADS_COMPLETED,
      () => {
        adPlaying = false;
        isPreroll = false;
        midrollPending = false;
        video.play().catch(()=>{});
      }
    );

    adsManager.addEventListener(
      google.ima.AdErrorEvent.Type.AD_ERROR,
      onAdError
    );

    if (isViewable) startAds();
  }

  function startAds() {
    try {
      adsManager.init(CONFIG.width, CONFIG.height, google.ima.ViewMode.NORMAL);
      adsManager.start();
    } catch (e) {}
  }

  function onAdError() {
    adPlaying = false;
    midrollPending = false;
    isPreroll = false;
    video.play().catch(()=>{});
  }

  /* ================= VIEWABILITY (WEBVIEW SAFE) ================= */

  function checkViewability() {

    if (playerDestroyed) return;

    const rect = container.getBoundingClientRect();
    const vh = window.innerHeight || doc.documentElement.clientHeight;

    const visibleHeight = Math.min(rect.bottom, vh) - Math.max(rect.top, 0);
    const ratio = visibleHeight / rect.height;

    const visible = ratio >= CONFIG.viewabilityThreshold;

    if (visible !== isViewable) {

      isViewable = visible;

      if (!visible) {
        video.pause();
        try { adsManager?.pause(); } catch(e){}
      } else {
        if (!adPlaying && !isPreroll) {
          video.play().catch(()=>{});
        }
        try { adsManager?.resume(); } catch(e){}
      }
    }
  }

  window.addEventListener("scroll", checkViewability, { passive: true });
  window.addEventListener("resize", checkViewability);
  document.addEventListener("visibilitychange", checkViewability);
  setInterval(checkViewability, 800);

  /* ================= MIDROLL TIMER ================= */

  setInterval(() => {

    if (
      video.paused ||
      adPlaying ||
      isPreroll ||
      !isViewable ||
      midrollPending
    ) return;

    const now = Date.now();
    watchTime += (now - lastWatchTick) / 1000;
    lastWatchTick = now;

    if (watchTime >= CONFIG.midrollInterval) {
      midrollPending = true;
      watchTime = 0;
      requestAds(true);
    }

  }, 500);

  /* ================= CONTROLS ================= */

  muteBtn.onclick = () => {
    video.muted = !video.muted;
    adsManager?.setVolume(video.muted ? 0 : 1);
    muteBtn.textContent = video.muted ? "🔇" : "🔊";
  };

  closeBtn.onclick = () => {
    playerDestroyed = true;
    try { adsManager?.destroy(); } catch(e){}
    video.pause();
    container.remove();
    window.__MC_OUTSTREAM__ = false;
  };

  loadIMA();

})();
