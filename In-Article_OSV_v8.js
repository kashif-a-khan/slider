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
  const MIDROLL_INTERVAL = 5;
  const ENABLE_STICKY = true; // set to false for pure in-article player


  const BTN_SIZE = isMobile ? 40 : 50;
  const BTN_FONT = isMobile ? 20 : 30;
  const BTN_LEFT_MARGIN = isMobile ? 5 : 0;

  const CONTENT_VIDEO =
    "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/WeAreGoingOnBullrun.mp4";

  const VAST_URLS = [
    "https://pubads.g.doubleclick.net/gampad/ads?iu=/1039154/Inhouse_Video_1_3&description_url=https%3A%2F%2Fwww.moneycontrol.com&tfcd=0&npa=0&sz=400x300%7C640x360%7C640x480&gdfp_req=1&unviewed_position_start=1&output=vast&env=vp&vpos=preroll&impl=s&vpw=640&vph=360",
    "https://pubads.g.doubleclick.net/gampad/ads?iu=/1039154/Inhouse_Video_1_4&description_url=https%3A%2F%2Fwww.moneycontrol.com&tfcd=0&npa=0&sz=400x300%7C640x360%7C640x480&gdfp_req=1&unviewed_position_start=1&output=vast&env=vp&vpos=midroll&impl=s&vpw=640&vph=360"
  ];

  let adsLoader = null;
  let adsManager = null;
  let imaStarted = false;

  let lastMidrollTime = 0;
  let midrollPlaying = false;
  let playerKilled = false;
  let isPreroll = true;
  let adc = null;
  let adPlaying = false;
  let isFloating = false;

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
    opacity:0;
    visibility:hidden;
    pointer-events:auto;
  `;

  const placeholder = doc.createElement("div");
  placeholder.style.width = WIDTH + "px";
  placeholder.style.height = HEIGHT + "px";
  placeholder.style.margin = isMobile
    ? "15px auto 20px auto"
    : "15px auto";
  placeholder.style.display = "none";

  container.innerHTML = `
    <video id="mc-video" playsinline muted
      style="width:100%;height:100%;background:#000"></video>

    <div id="mc-ad-layer"
      style="position:absolute;top:0;left:0;width:100%;height:100%;z-index:1000;"></div>

    <button id="mc-close"
      style="position:absolute;top:6px;left:${BTN_LEFT_MARGIN + 6}px;width:${BTN_SIZE}px;height:${BTN_SIZE}px;border-radius:50%;border:none;background:#fff;font-size:${BTN_FONT}px;display:none;cursor:pointer;z-index:2000;">×</button>

    <button id="mc-mute"
      style="position:absolute;bottom:6px;left:${BTN_LEFT_MARGIN + 6}px;width:${BTN_SIZE}px;height:${BTN_SIZE}px;border-radius:50%;border:none;background:#fff;font-size:${BTN_FONT}px;display:none;cursor:pointer;z-index:2000;">🔇</button>
  `;

  function injectInArticle() {

  // ---- PRIORITY TARGETS (in order) ----
  const prioritySelectors = [
    "#top_screen_news_mobile",
    ".prostocklist-tab-contents",
	".market_bx",
    "#startup-videos-main",
    "#mainprice",
    ".sec_indice_detail"
  ];

  // 1️⃣ Try priority elements first
  for (let selector of prioritySelectors) {
    const el = doc.querySelector(selector);
    if (el && el.offsetParent !== null) { // visible element
      el.after(container);
      return;
    }
  }

  // 2️⃣ FALLBACK → H1 + paragraphs (your current logic)
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
  adLayer.style.pointerEvents = "none";

  video.src = CONTENT_VIDEO;
  video.loop = true;
  video.muted = true;
  video.setAttribute("muted","");
  video.setAttribute("playsinline","");

  video.addEventListener("playing", () => {
    container.style.opacity = "1";
    container.style.visibility = "visible";
    container.style.pointerEvents = "auto";
    muteBtn.style.display = "block";
  });

  function getVPMute() {
    return video.muted ? 1 : 0;
  }

  let cachedInlineTop = null;

  function getInlineTop() {
    if (!isFloating) {
      const rect = container.getBoundingClientRect();
      cachedInlineTop = rect.top + window.scrollY;
    }
    return cachedInlineTop;
  }

  window.addEventListener("scroll", () => {
  if (!ENABLE_STICKY) return;

  const y = window.scrollY;
  const inlineTop = getInlineTop();
  const shouldFloat = y > inlineTop + 300;

  if (shouldFloat && !isFloating) {
    isFloating = true;
    placeholder.style.display = "block";

    container.style.position = "fixed";
    closeBtn.style.display = "block";

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
    isFloating = false;
    placeholder.style.display = "none";

    container.style.position = "relative";
    container.style.top = "auto";
    container.style.bottom = "auto";
    container.style.left = "auto";
    container.style.right = "auto";
    container.style.transform = "none";
    closeBtn.style.display = "none";
    container.style.margin = isMobile ? "15px auto 20px auto" : "15px auto";
  }
});

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

    adc.initialize();
    requestAds(false);
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
    const baseUrl = isMidroll ? VAST_URLS[1] : VAST_URLS[0];
    const vpmute  = getVPMute();

    req.adTagUrl =
      baseUrl +
      "&vpmute=" + vpmute +
      "&correlator=" + Date.now();

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
      () => { adPlaying = true; video.pause(); adLayer.style.pointerEvents = "auto";}
    );

    adsManager.addEventListener(
      google.ima.AdEvent.Type.ALL_ADS_COMPLETED,
      () => {
        isPreroll = false;
        midrollPlaying = false;
        adPlaying = false;
		adLayer.style.pointerEvents = "none";
        adsLoader.contentComplete();
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

  const visibilityObserver = new IntersectionObserver(entries => {
    if (!entries[0].isIntersecting) {
      video.pause();
      try { adsManager?.pause(); } catch(e){}
    } else {
      if (!adPlaying && !isPreroll) video.play().catch(()=>{});
      try { adsManager?.resume(); } catch(e){}
    }
  }, { threshold: 0.25 });

  visibilityObserver.observe(container);

  muteBtn.onclick = () => {
    const m = !video.muted;
    video.muted = m;
    if (adsManager) adsManager.setVolume(m ? 0 : 1);
    muteBtn.textContent = m ? "🔇" : "🔊";
  };

  closeBtn.onclick = () => {
    playerKilled = true;
    try { adsManager?.destroy(); } catch(e){}
    video.pause(); 
    video.src = "";
    container.remove();
    placeholder.remove();
    window.__MC_OUTSTREAM_LOADED__ = false;
  };

})();
