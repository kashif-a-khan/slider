(function () {

  if (window.__MC_OUTSTREAM_LOADED__) return;
  window.__MC_OUTSTREAM_LOADED__ = true;

  const doc = document;

  /* ---------------- CONSTANTS ---------------- */

  const WIDTH  = 340;
  const HEIGHT = 190;

  const INSERT_AFTER_P = 2;
  const MIDROLL_INTERVAL = 5;

  const BTN_SIZE = 40;
  const BTN_FONT = 20;

  const CONTENT_VIDEO =
    "https://www.w3schools.com/html/mov_bbb.mp4";

  /* ----------- YOUR EXACT VAST TAGS (UNCHANGED) ----------- */

  const PREROLL_WATERFALL = [
    "https://pubads.g.doubleclick.net/gampad/ads?iu=/1039154/Inhouse_Video_1_3&description_url=https%3A%2F%2Fwww.moneycontrol.com&tfcd=0&npa=0&sz=400x300%7C640x360%7C640x480&gdfp_req=1&unviewed_position_start=1&output=vast&env=vp&vpos=preroll&impl=s&plcmt=1&vpw=640&vph=360",
    "https://pubads.g.doubleclick.net/gampad/ads?iu=/1039154/Inhouse_Video_1_4&description_url=https%3A%2F%2Fwww.moneycontrol.com&tfcd=0&npa=0&sz=400x300%7C640x360%7C640x480&gdfp_req=1&unviewed_position_start=1&output=vast&env=vp&vpos=midroll&impl=s&plcmt=1&vpw=640&vph=360"
  ];

  /* ---------------- STATE ---------------- */

  let adsLoader = null;
  let adsManager = null;
  let adc = null;

  let adPlaying = false;
  let isPreroll = true;
  let midrollPlaying = false;
  let playerKilled = false;

  let actuallyViewable = false;
  let appVisible = true;

  let prerollRequested = false;
  let contentStarted = false;

  let waterfallIndex = 0;
  let waterfallTimeout = null;
  const WATERFALL_TIMEOUT_MS = 3000;

  let watchTime = 0;

  /* ---------------- PLAYER UI ---------------- */

  const container = doc.createElement("div");
  container.style.cssText = `
    width:${WIDTH}px;
    height:${HEIGHT}px;
    background:#000;
    margin:15px auto 20px auto;
    position:relative;
    z-index:999999;
  `;

  container.innerHTML = `
    <video id="mc-video" style="width:100%;height:100%;background:#000" muted playsinline></video>
    <div id="mc-ad-layer"
      style="position:absolute;top:0;left:0;width:100%;height:100%;z-index:1000;"></div>
    <button id="mc-close"
      style="position:absolute;top:6px;left:6px;width:${BTN_SIZE}px;height:${BTN_SIZE}px;border-radius:50%;border:none;background:#fff;font-size:${BTN_FONT}px;z-index:2000;">×</button>
    <button id="mc-mute"
      style="position:absolute;bottom:6px;left:6px;width:${BTN_SIZE}px;height:${BTN_SIZE}px;border-radius:50%;border:none;background:#fff;font-size:${BTN_FONT}px;z-index:2000;">🔇</button>
  `;

  function injectInArticle() {
    const paragraphs = doc.querySelectorAll("p");
    if (paragraphs.length >= INSERT_AFTER_P) {
      paragraphs[INSERT_AFTER_P - 1].after(container);
    } else {
      doc.body.appendChild(container);
    }
  }

  injectInArticle();

  const video = container.querySelector("#mc-video");
  const adLayer = container.querySelector("#mc-ad-layer");
  const closeBtn = container.querySelector("#mc-close");
  const muteBtn  = container.querySelector("#mc-mute");

  video.src = CONTENT_VIDEO;

  /* ---------------- IMA ---------------- */

  function loadIMA() {
    const s = doc.createElement("script");
    s.src = "https://imasdk.googleapis.com/js/sdkloader/ima3.js";
    s.onload = initIMA;
    doc.head.appendChild(s);
  }

  function initIMA() {

    adc = new google.ima.AdDisplayContainer(adLayer, video);
    adsLoader = new google.ima.AdsLoader(adc);

    adsLoader.addEventListener(
      google.ima.AdsManagerLoadedEvent.Type.ADS_MANAGER_LOADED,
      onAdsManagerLoaded
    );

    adsLoader.addEventListener(
      google.ima.AdErrorEvent.Type.AD_ERROR,
      () => {
        if (isPreroll) startContent();
        else midrollPlaying = false;
      }
    );

    adc.initialize();
  }

  function requestAds() {

    if (playerKilled) return;
    if (waterfallIndex >= PREROLL_WATERFALL.length) {
      if (isPreroll) startContent();
      return;
    }

    const req = new google.ima.AdsRequest();
    req.adTagUrl =
      PREROLL_WATERFALL[waterfallIndex] +
      "&correlator=" + Date.now();

    req.linearAdSlotWidth = WIDTH;
    req.linearAdSlotHeight = HEIGHT;
    req.setAdWillAutoPlay(true);

    adsLoader.requestAds(req);

    clearTimeout(waterfallTimeout);
    waterfallTimeout = setTimeout(() => {
      waterfallIndex++;
      requestAds();
    }, WATERFALL_TIMEOUT_MS);
  }

  function onAdsManagerLoaded(e) {

    clearTimeout(waterfallTimeout);

    adsManager = e.getAdsManager(video);

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
        midrollPlaying = false;
        if (isPreroll) {
          isPreroll = false;
          startContent();
        }
      }
    );

    try {
      adsManager.init(WIDTH, HEIGHT, google.ima.ViewMode.NORMAL);
      adsManager.start();
    } catch(e) {
      if (isPreroll) startContent();
    }
  }

  function startContent() {
    if (contentStarted || playerKilled) return;

    contentStarted = true;
    video.src = CONTENT_VIDEO;
    video.load();
    video.play().catch(()=>{});
  }

  /* ---------------- VIEWABILITY (FIXED PROPERLY) ---------------- */

  const observer = new IntersectionObserver((entries) => {

    if (playerKilled) return;

    const ratio = entries[0].intersectionRatio;
    const visible = ratio >= 0.25 && appVisible;

    if (visible && !actuallyViewable) {

      actuallyViewable = true;

      if (isPreroll && !prerollRequested) {
        prerollRequested = true;
        waterfallIndex = 0;
        requestAds();
      }

      if (!isPreroll && !adPlaying) {
        video.play().catch(()=>{});
        try { adsManager?.resume(); } catch(e){}
      }
    }

    if (!visible && actuallyViewable) {

      actuallyViewable = false;

      video.pause();
      try { adsManager?.pause(); } catch(e){}
    }

  }, { threshold: [0, 0.25, 0.5, 1] });

  observer.observe(container);

  /* ---------------- MIDROLL ---------------- */

  setInterval(()=>{

    if (
      video.paused ||
      adPlaying ||
      isPreroll ||
      !actuallyViewable ||
      !appVisible ||
      playerKilled
    ) return;

    watchTime++;

    if (watchTime >= MIDROLL_INTERVAL && !midrollPlaying) {
      midrollPlaying = true;
      watchTime = 0;
      waterfallIndex = 1;
      requestAds();
    }

  },1000);

  /* ---------------- LIFECYCLE ---------------- */

  document.addEventListener("visibilitychange",()=>{
    appVisible = !document.hidden;

    if (!appVisible) {
      video.pause();
      try { adsManager?.pause(); } catch(e){}
    } else if (actuallyViewable && !adPlaying) {
      video.play().catch(()=>{});
      try { adsManager?.resume(); } catch(e){}
    }
  });

  /* ---------------- CONTROLS ---------------- */

  muteBtn.onclick=()=>{
    video.muted=!video.muted;
    try{ adsManager?.setVolume(video.muted?0:1); }catch(e){}
    muteBtn.textContent=video.muted?"🔇":"🔊";
  };

  closeBtn.onclick=()=>{
    playerKilled=true;
    try{adsManager?.destroy();}catch(e){}
    video.pause();
    container.remove();
    window.__MC_OUTSTREAM_LOADED__=false;
  };

  loadIMA();

})();
