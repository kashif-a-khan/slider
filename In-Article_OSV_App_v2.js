(function () {

  if (window.__MC_OUTSTREAM_LOADED__) return;
  window.__MC_OUTSTREAM_LOADED__ = true;

  const doc = document;

  const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);

  const WIDTH  = isMobile ? 340 : 640;
  const HEIGHT = isMobile ? 190 : 360;

  const STICKY_BOTTOM = isMobile ? 110 : 12;
  const STICKY_TOP = 50;

  const INSERT_AFTER_P = 2;
  const MIDROLL_INTERVAL = 15;
  const ENABLE_STICKY = false;

  const BTN_SIZE = isMobile ? 40 : 50;
  const BTN_FONT = isMobile ? 20 : 30;
  const BTN_LEFT_MARGIN = isMobile ? 5 : 0;

  const CONTENT_VIDEO =
    "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/WeAreGoingOnBullrun.mp4";

  const VAST_URLS = [
    "https://pubads.g.doubleclick.net/gampad/ads?iu=/1039154/Inhouse_Video_1_3&output=vast&env=vp&vpos=preroll&impl=s&plcmt=1",
    "https://pubads.g.doubleclick.net/gampad/ads?iu=/1039154/Inhouse_Video_1_4&output=vast&env=vp&vpos=midroll&impl=s&plcmt=1"
  ];

  let adsLoader = null;
  let adsManager = null;
  let adc = null;

  let lastMidrollTime = 0;
  let midrollPlaying = false;
  let playerKilled = false;
  let isPreroll = true;
  let adPlaying = false;
  let viewable = false;
  let adsManagerReady = false;

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
  `;

  container.innerHTML = `
    <video id="mc-video" playsinline muted
      style="width:100%;height:100%;background:#000"></video>

    <div id="mc-ad-layer"
      style="position:absolute;top:0;left:0;width:100%;height:100%;z-index:1000;"></div>
  `;

  function injectInArticle() {
    const h1 = doc.querySelector("h1");
    if (!h1) {
      doc.body.appendChild(container);
      return;
    }
    const paras = Array.from(doc.querySelectorAll("p"))
      .filter(p => h1.compareDocumentPosition(p) & Node.DOCUMENT_POSITION_FOLLOWING);
    (paras[INSERT_AFTER_P - 1] || h1).after(container);
  }

  injectInArticle();

  const video = container.querySelector("#mc-video");
  const adLayer = container.querySelector("#mc-ad-layer");

  video.src = CONTENT_VIDEO;
  video.loop = true;
  video.muted = true;
  video.setAttribute("muted","");
  video.setAttribute("playsinline","");

  loadIMA();
  observeViewability();

  function loadIMA() {
    if (window.google && window.google.ima) {
      initIMA();
      return;
    }
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
      tryNextVast
    );

    // 🔥 Android WebView Safe: wait for real gesture
    waitForGesture();
  }

  function waitForGesture() {

    function startIMAOnce() {

      document.removeEventListener("touchstart", startIMAOnce);
      document.removeEventListener("click", startIMAOnce);

      try {
        adc.initialize();

        video.play().then(function () {
          requestAds(false);
        }).catch(function () {
          requestAds(false);
        });

      } catch (e) {}
    }

    document.addEventListener("touchstart", startIMAOnce, { once: true });
    document.addEventListener("click", startIMAOnce, { once: true });
  }

  function observeViewability() {
    const observer = new IntersectionObserver(entries => {
      if (entries[0].intersectionRatio >= 0.25) {
        viewable = true;
        startAdsIfViewable();
        observer.disconnect();
      }
    }, { threshold: 0.25 });

    observer.observe(container);
  }

  function startAdsIfViewable() {
    if (!viewable || !adsManagerReady || playerKilled) return;
    try {
      adsManager.init(WIDTH, HEIGHT, google.ima.ViewMode.NORMAL);
      adsManager.start();
    } catch(e){}
  }

  function requestAds(isMidroll) {
    if (playerKilled) return;

    const req = new google.ima.AdsRequest();
    req.adTagUrl = (isMidroll ? VAST_URLS[1] : VAST_URLS[0]) + "&correlator=" + Date.now();
    req.linearAdSlotWidth = WIDTH;
    req.linearAdSlotHeight = HEIGHT;
    req.setAdWillAutoPlay(true);

    adsLoader.requestAds(req);
  }

  function onAdsManagerLoaded(e) {
    adsManager = e.getAdsManager(video);

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

  video.addEventListener("timeupdate", () => {
    if (video.currentTime < lastMidrollTime) lastMidrollTime = 0;
    if (playerKilled || midrollPlaying || isPreroll || !viewable) return;

    if (video.currentTime - lastMidrollTime >= MIDROLL_INTERVAL) {
      lastMidrollTime = video.currentTime;
      midrollPlaying = true;
      requestAds(true);
    }
  });

  function tryNextVast() {
    if (adsManager) adsManager.destroy();
    midrollPlaying = false;
    adPlaying = false;
  }

})();
