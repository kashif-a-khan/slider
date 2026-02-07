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
  const ENABLE_STICKY = true;

  const CONTENT_VIDEO =
    "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/WeAreGoingOnBullrun.mp4";

  const VAST_URLS = [
    "https://pubads.g.doubleclick.net/gampad/ads?iu=/1039154/Inhouse_Video_1_3&description_url=https%3A%2F%2Fwww.moneycontrol.com&tfcd=0&npa=0&sz=400x300%7C640x360%7C640x480&gdfp_req=1&unviewed_position_start=1&output=vast&env=vp&vpos=preroll&impl=s&vpw=640&vph=360",
    "https://pubads.g.doubleclick.net/gampad/ads?iu=/1039154/Inhouse_Video_1_4&description_url=https%3A%2F%2Fwww.moneycontrol.com&tfcd=0&npa=0&sz=400x300%7C640x360%7C640x480&gdfp_req=1&output=vast&env=vp&vpos=midroll&impl=s&vpw=640&vph=360"
  ];

  let adsLoader, adsManager, adc;
  let viewable = false;
  let adsManagerReady = false;
  let adStarted = false;
  let midrollPlaying = false;
  let lastMidrollTime = 0;
  let isPreroll = true;
  let adPlaying = false;
  let isFloating = false;
  let playerKilled = false;

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
  `;

  container.innerHTML = `
    <video id="mc-video" playsinline muted
      style="width:100%;height:100%;background:#000"></video>
    <div id="mc-ad-layer"
      style="position:absolute;top:0;left:0;width:100%;height:100%;z-index:1000;"></div>
    <button id="mc-close"
      style="position:absolute;top:6px;left:6px;width:40px;height:40px;border-radius:50%;border:none;background:#fff;font-size:20px;display:none;cursor:pointer;z-index:2000;">×</button>
    <button id="mc-mute"
      style="position:absolute;bottom:6px;left:6px;width:40px;height:40px;border-radius:50%;border:none;background:#fff;font-size:20px;display:none;cursor:pointer;z-index:2000;">🔇</button>
  `;

  function injectPlayer() {

    const h1 = doc.querySelector("h1");

    if (h1) {
      const paras = Array.from(doc.querySelectorAll("p"))
        .filter(p => h1.compareDocumentPosition(p) & Node.DOCUMENT_POSITION_FOLLOWING);

      if (paras.length >= INSERT_AFTER_P) {
        paras[INSERT_AFTER_P - 1].after(container);
        return;
      }
    }

    injectInSecondViewport();
  }

  function injectInSecondViewport() {

    const scrollTarget = window.innerHeight;

    const elements = Array.from(document.body.children);

    for (let el of elements) {
      const rect = el.getBoundingClientRect();
      const elTop = rect.top + window.scrollY;

      if (elTop >= scrollTarget) {
        el.before(container);
        return;
      }
    }

    document.body.appendChild(container);
  }

  if (document.readyState === "complete") {
    injectPlayer();
  } else {
    window.addEventListener("load", injectPlayer);
  }

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
    muteBtn.style.display = "block";
  });

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
      () => {}
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
    req.setAdWillPlayMuted(true);

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
        adPlaying = false;
        video.play().catch(()=>{});
      }
    );

    adsManagerReady = true;
    startAdsIfViewable();
  }

  function startAdsIfViewable() {
    if (!viewable || !adsManagerReady || adStarted || playerKilled) return;

    try {
      adsManager.init(WIDTH, HEIGHT, google.ima.ViewMode.NORMAL);
      adsManager.start();
      adStarted = true;
    } catch (e) {}
  }

  const viewObserver = new IntersectionObserver(entries => {
    if (entries[0].intersectionRatio >= 0.25) {
      viewable = true;
      startAdsIfViewable();
    }
  }, { threshold: 0.25 });

  viewObserver.observe(container);

  window.addEventListener("scroll", () => {
    if (!ENABLE_STICKY) return;

    const rect = container.getBoundingClientRect();
    const shouldFloat = rect.top < -300;

    if (shouldFloat && !isFloating) {
      isFloating = true;
      closeBtn.style.display = "block";
      container.style.position = "fixed";

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
    }

    if (!shouldFloat && isFloating) {
      isFloating = false;
      container.style.position = "relative";
      container.style.transform = "none";
      closeBtn.style.display = "none";
    }
  });

  video.addEventListener("timeupdate", () => {
    if (playerKilled || midrollPlaying || isPreroll || !viewable) return;

    if (video.currentTime - lastMidrollTime >= MIDROLL_INTERVAL) {
      lastMidrollTime = video.currentTime;
      midrollPlaying = true;
      requestAds(true);
    }
  });

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
    container.remove();
    window.__MC_OUTSTREAM_LOADED__ = false;
  };

  loadIMA();

})();
