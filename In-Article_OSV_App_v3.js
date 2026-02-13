(function () {

  if (window.__MC_OUTSTREAM_LOADED__) return;
  window.__MC_OUTSTREAM_LOADED__ = true;

  const doc = document;

  /* ---------------- MOBILE WEBVIEW CONSTANTS ---------------- */

  const WIDTH  = 340;
  const HEIGHT = 190;

  const INSERT_AFTER_P = 2;
  const MIDROLL_INTERVAL = 15;

  const BTN_SIZE = 40;
  const BTN_FONT = 20;

  const CONTENT_VIDEO =
    "https://www.w3schools.com/html/mov_bbb.mp4";

  const VAST_URLS = [
    "https://pubads.g.doubleclick.net/gampad/ads?iu=/1039154/Inhouse_Video_1_3&description_url=https%3A%2F%2Fwww.moneycontrol.com&tfcd=0&npa=0&sz=400x300%7C640x360%7C640x480&gdfp_req=1&unviewed_position_start=1&output=vast&env=vp&vpos=preroll&impl=s&plcmt=1&vpw=640&vph=360",
    "https://pubads.g.doubleclick.net/gampad/ads?iu=/1039154/Inhouse_Video_1_4&description_url=https%3A%2F%2Fwww.moneycontrol.com&tfcd=0&npa=0&sz=400x300%7C640x360%7C640x480&gdfp_req=1&unviewed_position_start=1&output=vast&env=vp&vpos=midroll&impl=s&plcmt=1&vpw=640&vph=360"
  ];

  let adsLoader = null;
  let adsManager = null;
  let adc = null;

  let viewable = false;
  let adPlaying = false;
  let midrollPlaying = false;
  let isPreroll = true;
  let playerKilled = false;
  let adsManagerReady = false;

  let watchTime = 0;
  let lastTick = Date.now();

  /* ---------------- PLAYER UI ---------------- */

  const container = doc.createElement("div");
  container.id = "mc-outstream-player";
  container.style.cssText = `
    width:${WIDTH}px;
    height:${HEIGHT}px;
    background:#000;
    margin:15px auto 20px auto;
    position:relative;
    z-index:999999;
    opacity:0;
    visibility:hidden;
  `;

  container.innerHTML = `
    <video id="mc-video" playsinline muted
      style="width:100%;height:100%;background:#000"></video>

    <div id="mc-ad-layer"
      style="position:absolute;top:0;left:0;width:100%;height:100%;z-index:1000;"></div>

    <button id="mc-close"
      style="position:absolute;top:6px;left:6px;width:${BTN_SIZE}px;height:${BTN_SIZE}px;border-radius:50%;border:none;background:#fff;font-size:${BTN_FONT}px;cursor:pointer;z-index:2000;">×</button>

    <button id="mc-mute"
      style="position:absolute;bottom:6px;left:6px;width:${BTN_SIZE}px;height:${BTN_SIZE}px;border-radius:50%;border:none;background:#fff;font-size:${BTN_FONT}px;cursor:pointer;z-index:2000;">🔇</button>
  `;

  /* ---------------- ARTICLE INJECTION ---------------- */

  function injectInArticle() {

  const paragraphs = doc.querySelectorAll("p");

  // If at least 2 paragraphs exist → insert after 2nd
  if (paragraphs.length >= INSERT_AFTER_P) {
    paragraphs[INSERT_AFTER_P - 1].after(container);
    return;
  }

  // If only 1 paragraph exists → insert after it
  if (paragraphs.length === 1) {
    paragraphs[0].after(container);
    return;
  }

  // If NO paragraph exists → append at end of body
  doc.body.appendChild(container);
}


  injectInArticle();

  const video = container.querySelector("#mc-video");
  const adLayer = container.querySelector("#mc-ad-layer");
  const closeBtn = container.querySelector("#mc-close");
  const muteBtn  = container.querySelector("#mc-mute");

  video.src = CONTENT_VIDEO;
  video.loop = true;
  video.muted = true;
  video.setAttribute("muted","");
  video.setAttribute("playsinline","");

  video.addEventListener("playing", () => {
    container.style.opacity = "1";
    container.style.visibility = "visible";
  });

  /* ---------------- IMA LOADER ---------------- */

  function loadIMA() {
    if (window.google && window.google.ima) return initIMA();

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
      () => { midrollPlaying = false; adPlaying = false; }
    );

    adc.initialize();
    requestAds(false);
  }

  function requestAds(isMidroll) {

    if (playerKilled) return;

    const req = new google.ima.AdsRequest();
    const baseUrl = isMidroll ? VAST_URLS[1] : VAST_URLS[0];

    req.adTagUrl = baseUrl + "&correlator=" + Date.now();
    req.linearAdSlotWidth = WIDTH;
    req.linearAdSlotHeight = HEIGHT;
    req.setAdWillAutoPlay(true);
    req.plcmt = 1;

    adsLoader.requestAds(req);
  }

  function onAdsManagerLoaded(e) {

    adsManager = e.getAdsManager(video);
    adsManager.setVolume(video.muted ? 0 : 1);

    adsManager.addEventListener(
      google.ima.AdEvent.Type.STARTED,
      () => { adPlaying = true; video.pause(); }
    );

    adsManager.addEventListener(
      google.ima.AdEvent.Type.ALL_ADS_COMPLETED,
      () => {
        isPreroll = false;
        midrollPlaying = false;
        adPlaying = false;
        video.play().catch(()=>{});
      }
    );

    adsManagerReady = true;
    startAdsIfViewable();
  }

  /* ---------------- VIEWABILITY ---------------- */

  const observer = new IntersectionObserver(entries => {
    if (entries[0].intersectionRatio >= 0.25) {
      viewable = true;
      startAdsIfViewable();
      observer.disconnect();
    }
  }, { threshold: 0.25 });

  observer.observe(container);

  function startAdsIfViewable() {
    if (!viewable || !adsManagerReady) return;
    try {
      adsManager.init(WIDTH, HEIGHT, google.ima.ViewMode.NORMAL);
      adsManager.start();
    } catch(e){}
  }

  /* ---------------- MIDROLL WATCH TIMER ---------------- */

  setInterval(() => {

    if (
      video.paused ||
      adPlaying ||
      isPreroll ||
      !viewable ||
      playerKilled
    ) return;

    const now = Date.now();
    watchTime += (now - lastTick) / 1000;
    lastTick = now;

    if (watchTime >= MIDROLL_INTERVAL && !midrollPlaying) {
      midrollPlaying = true;
      watchTime = 0;
      requestAds(true);
    }

  }, 500);

  /* ---------------- CONTROLS ---------------- */

  muteBtn.onclick = () => {
    video.muted = !video.muted;
    if (adsManager) adsManager.setVolume(video.muted ? 0 : 1);
    muteBtn.textContent = video.muted ? "🔇" : "🔊";
  };

  closeBtn.onclick = () => {
    playerKilled = true;
    try { adsManager?.destroy(); } catch(e){}
    video.pause();
    video.src = "";
    container.remove();
    window.__MC_OUTSTREAM_LOADED__ = false;
  };

  loadIMA();

})();
