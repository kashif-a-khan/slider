(function () {

  if (window.__MC_OUTSTREAM_LOADED__) return;
  window.__MC_OUTSTREAM_LOADED__ = true;

  const doc = document;

  /* ---------------- CONSTANTS ---------------- */

  const WIDTH  = 340;
  const HEIGHT = 190;

  const INSERT_AFTER_P = 2;
  const MIDROLL_INTERVAL = 5;

  const CONTENT_VIDEO =
    "https://www.w3schools.com/html/mov_bbb.mp4";

  const VAST_URLS = [
    "https://pubads.g.doubleclick.net/gampad/ads?iu=/1039154/Inhouse_Video_1_3&description_url=https%3A%2F%2Fwww.moneycontrol.com&tfcd=0&npa=0&sz=400x300%7C640x360%7C640x480&gdfp_req=1&unviewed_position_start=1&output=vast&env=vp&vpos=preroll&impl=s&plcmt=1&vpw=640&vph=360",
    "https://pubads.g.doubleclick.net/gampad/ads?iu=/1039154/Inhouse_Video_1_4&description_url=https%3A%2F%2Fwww.moneycontrol.com&tfcd=0&npa=0&sz=400x300%7C640x360%7C640x480&gdfp_req=1&unviewed_position_start=1&output=vast&env=vp&vpos=midroll&impl=s&plcmt=1&vpw=640&vph=360"
  ];

  /* ---------------- STATE ---------------- */

  let adsLoader = null;
  let adsManager = null;
  let adDisplayContainer = null;

  let adPlaying = false;
  let isPreroll = true;
  let imaInitialized = false;
  let adsRequested = false;

  let actuallyViewable = false;
  let appVisible = true;

  let watchTime = 0;
  let lastTick = Date.now();

  /* ---------------- PLAYER UI ---------------- */

  const container = doc.createElement("div");
  container.style.cssText = `
    width:${WIDTH}px;
    height:${HEIGHT}px;
    background:#000;
    margin:15px auto 20px auto;
    position:relative;
  `;

  container.innerHTML = `
    <video id="mc-video"
      style="width:100%;height:100%;background:#000"
      muted
      playsinline
      webkit-playsinline></video>

    <div id="mc-ad-layer"
      style="position:absolute;top:0;left:0;width:100%;height:100%;z-index:1000;"></div>
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

  video.src = CONTENT_VIDEO;
  video.load();

  /* ---------------- LOAD IMA ---------------- */

  function loadIMA() {
    if (window.google && window.google.ima) return;
    const s = doc.createElement("script");
    s.src = "https://imasdk.googleapis.com/js/sdkloader/ima3.js";
    s.onload = () => {};
    doc.head.appendChild(s);
  }

  loadIMA();

  /* ---------------- INIT IMA (ON SCROLL) ---------------- */

  function initIMA() {

    if (imaInitialized || !window.google || !google.ima) return;

    imaInitialized = true;

    adDisplayContainer = new google.ima.AdDisplayContainer(adLayer, video);
    adsLoader = new google.ima.AdsLoader(adDisplayContainer);

    adsLoader.addEventListener(
      google.ima.AdsManagerLoadedEvent.Type.ADS_MANAGER_LOADED,
      (e) => {

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
            isPreroll = false;
            video.play().catch(()=>{});
          }
        );

        try {
          adsManager.init(WIDTH, HEIGHT, google.ima.ViewMode.NORMAL);
          adsManager.start();
        } catch(e){
          video.play().catch(()=>{});
        }
      }
    );

    adsLoader.addEventListener(
      google.ima.AdErrorEvent.Type.AD_ERROR,
      () => {
        video.play().catch(()=>{});
      }
    );

    adDisplayContainer.initialize();
  }

  function requestPreroll() {

    if (adsRequested || !adsLoader) return;

    adsRequested = true;

    const req = new google.ima.AdsRequest();
    req.adTagUrl = VAST_URLS[0] + "&correlator=" + Date.now();
    req.linearAdSlotWidth = WIDTH;
    req.linearAdSlotHeight = HEIGHT;
    req.setAdWillAutoPlay(true);

    adsLoader.requestAds(req);
  }

  /* ---------------- VIEWABILITY ---------------- */

  function isInViewport() {

    const rect = container.getBoundingClientRect();
    const vh = window.innerHeight || document.documentElement.clientHeight;

    if (rect.height === 0) return false;

    const visible = Math.min(rect.bottom, vh) - Math.max(rect.top, 0);
    const ratio = visible / rect.height;

    return ratio >= 0.25;
  }

  function evaluateViewability() {

    const visible = appVisible && isInViewport();

    if (visible && !actuallyViewable) {
      actuallyViewable = true;

      initIMA();           // ← triggered by scroll
      requestPreroll();    // ← safe, viewable
      if (!adPlaying && !isPreroll) {
        video.play().catch(()=>{});
      }
    }

    if (!visible && actuallyViewable) {
      actuallyViewable = false;
      video.pause();
      try { adsManager?.pause(); } catch(e){}
    }
  }

  /* SCROLL = USER GESTURE IN WEBVIEW */

  window.addEventListener("scroll", evaluateViewability, { passive: true });

  /* FALLBACK POLL (WEBVIEW SAFE) */

  setInterval(evaluateViewability, 500);

  /* APP VISIBILITY */

  document.addEventListener("visibilitychange",()=>{
    if(document.hidden){
      appVisible=false;
      video.pause();
    } else {
      appVisible=true;
      if(actuallyViewable && !adPlaying) video.play().catch(()=>{});
    }
  });

})();
