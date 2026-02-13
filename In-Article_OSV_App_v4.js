(function () {

  if (window.__MC_OUTSTREAM__) return;
  window.__MC_OUTSTREAM__ = true;

  const VAST_TAG = "https://pubads.g.doubleclick.net/gampad/ads?iu=/1039154/Inhouse_Video_1_3&output=vast&env=vp&vpos=preroll&impl=s&plcmt=1";

  /* =========================
     LOAD IMA SDK
  ========================== */

  function loadIMA(callback) {
    if (window.google && google.ima) {
      callback();
      return;
    }

    const s = document.createElement("script");
    s.src = "https://imasdk.googleapis.com/js/sdkloader/ima3.js";
    s.onload = callback;
    document.head.appendChild(s);
  }

  loadIMA(initPlayer);

  function initPlayer() {

    /* =========================
       CREATE CONTAINER
    ========================== */

    const container = document.createElement("div");
    container.style.cssText = `
      position:relative;
      width:100%;
      max-width:640px;
      height:360px;
      margin:20px auto;
      background:#000;
      overflow:hidden;
    `;

    const video = document.createElement("video");
    video.playsInline = true;
    video.muted = true;
    video.style.cssText = `
      position:absolute;
      top:0;
      left:0;
      width:100%;
      height:100%;
      background:#000;
    `;

    const adLayer = document.createElement("div");
    adLayer.style.cssText = `
      position:absolute;
      top:0;
      left:0;
      width:100%;
      height:100%;
      z-index:5;
    `;

    const closeBtn = document.createElement("button");
    closeBtn.innerHTML = "✕";
    closeBtn.style.cssText = `
      position:absolute;
      top:6px;
      left:6px;
      z-index:20;
      display:none;
      background:rgba(0,0,0,0.6);
      color:#fff;
      border:0;
      padding:4px 8px;
      cursor:pointer;
    `;

    const muteBtn = document.createElement("button");
    muteBtn.innerHTML = "🔇";
    muteBtn.style.cssText = `
      position:absolute;
      bottom:6px;
      left:6px;
      z-index:20;
      background:rgba(0,0,0,0.6);
      color:#fff;
      border:0;
      padding:4px 8px;
      cursor:pointer;
    `;

    container.appendChild(video);
    container.appendChild(adLayer);
    container.appendChild(closeBtn);
    container.appendChild(muteBtn);

    document.body.appendChild(container);

    let adsManager;
    let adsLoader;

    /* =========================
       IMA SETUP
    ========================== */

    const adDisplayContainer = new google.ima.AdDisplayContainer(adLayer, video);
    adsLoader = new google.ima.AdsLoader(adDisplayContainer);

    adsLoader.addEventListener(
      google.ima.AdsManagerLoadedEvent.Type.ADS_MANAGER_LOADED,
      function (event) {

        adsManager = event.getAdsManager(video);

        adsManager.addEventListener(
          google.ima.AdErrorEvent.Type.AD_ERROR,
          destroyPlayer
        );

        adsManager.addEventListener(
          google.ima.AdEvent.Type.ALL_ADS_COMPLETED,
          destroyPlayer
        );

        adsManager.init(
          container.offsetWidth,
          container.offsetHeight,
          google.ima.ViewMode.NORMAL
        );

        adsManager.start();

        adLayer.style.pointerEvents = "none";
        closeBtn.style.display = "block";
      }
    );

    adsLoader.addEventListener(
      google.ima.AdErrorEvent.Type.AD_ERROR,
      destroyPlayer
    );

    function requestAd() {
      adDisplayContainer.initialize();

      const adsRequest = new google.ima.AdsRequest();
      adsRequest.adTagUrl = VAST_TAG;
      adsRequest.linearAdSlotWidth = container.offsetWidth;
      adsRequest.linearAdSlotHeight = container.offsetHeight;

      adsLoader.requestAds(adsRequest);
    }

    /* =========================
       VIEWPORT TRIGGER (25%)
    ========================== */

    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting && entry.intersectionRatio >= 0.25) {
          observer.disconnect();
          requestAd();
        }
      });
    }, { threshold: 0.25 });

    observer.observe(container);

    /* =========================
       MUTE
    ========================== */

    muteBtn.onclick = function () {
      video.muted = !video.muted;

      try {
        if (adsManager) {
          adsManager.setVolume(video.muted ? 0 : 1);
        }
      } catch(e){}

      muteBtn.innerHTML = video.muted ? "🔇" : "🔊";
    };

    /* =========================
       CLOSE
    ========================== */

    closeBtn.onclick = destroyPlayer;

    function destroyPlayer() {
      try { adsManager && adsManager.destroy(); } catch(e){}
      container.remove();
    }

  }

})();
