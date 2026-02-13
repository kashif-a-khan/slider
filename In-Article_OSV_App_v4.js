(function () {

  if (window.__MC_OUTSTREAM__) return;
  window.__MC_OUTSTREAM__ = true;

  const VAST_TAG = "https://pubads.g.doubleclick.net/gampad/ads?iu=/1039154/Inhouse_Video_1_3&description_url=https%3A%2F%2Fwww.moneycontrol.com&tfcd=0&npa=0&sz=400x300%7C640x360%7C640x480&gdfp_req=1&unviewed_position_start=1&output=vast&env=vp&vpos=preroll&impl=s&plcmt=1&vpw=640&vph=360";

  /* ================= LOAD IMA ================= */

  function loadIMA(callback) {
    if (window.google && google.ima) return callback();
    const s = document.createElement("script");
    s.src = "https://imasdk.googleapis.com/js/sdkloader/ima3.js";
    s.onload = callback;
    document.head.appendChild(s);
  }

  loadIMA(initPlayer);

  function initPlayer() {

    /* ================= CREATE CONTAINER ================= */

    const container = document.createElement("div");
    container.style.cssText = `
      position:relative;
      width:100%;
      max-width:640px;
      height:360px;
      margin:20px auto;
      background:#000;
      overflow:hidden;
      z-index:1;
    `;

    const video = document.createElement("video");
    video.playsInline = true;
    video.muted = true;
    video.loop = false;
    video.style.cssText = `
      position:absolute;
      top:0;left:0;
      width:100%;height:100%;
      z-index:1;
      background:#000;
    `;

    const adLayer = document.createElement("div");
    adLayer.style.cssText = `
      position:absolute;
      top:0;left:0;
      width:100%;height:100%;
      z-index:2;
      pointer-events:none;
    `;

    const controlsLayer = document.createElement("div");
    controlsLayer.style.cssText = `
      position:absolute;
      top:0;left:0;
      width:100%;height:100%;
      z-index:9999;
      pointer-events:none;
    `;

    const closeBtn = document.createElement("button");
    closeBtn.innerHTML = "✕";
    closeBtn.style.cssText = `
      position:absolute;
      top:8px;
      right:8px;
      background:rgba(0,0,0,0.6);
      color:#fff;
      border:0;
      padding:6px 10px;
      font-size:14px;
      cursor:pointer;
      pointer-events:auto;
    `;

    const muteBtn = document.createElement("button");
    muteBtn.innerHTML = "🔇";
    muteBtn.style.cssText = `
      position:absolute;
      bottom:8px;
      left:8px;
      background:rgba(0,0,0,0.6);
      color:#fff;
      border:0;
      padding:6px 10px;
      font-size:14px;
      cursor:pointer;
      pointer-events:auto;
    `;

    controlsLayer.appendChild(closeBtn);
    controlsLayer.appendChild(muteBtn);

    container.appendChild(video);
    container.appendChild(adLayer);
    container.appendChild(controlsLayer);

    document.body.appendChild(container);

    let adsManager;
    let adsLoader;

    /* ================= IMA SETUP ================= */

    const adDisplayContainer = new google.ima.AdDisplayContainer(adLayer, video);
    adsLoader = new google.ima.AdsLoader(adDisplayContainer);

    adsLoader.addEventListener(
      google.ima.AdsManagerLoadedEvent.Type.ADS_MANAGER_LOADED,
      function (event) {
        adsManager = event.getAdsManager(video);

        adsManager.addEventListener(
          google.ima.AdEvent.Type.STARTED,
          function () {
            adLayer.style.pointerEvents = "auto";
          }
        );

        adsManager.addEventListener(
          google.ima.AdEvent.Type.ALL_ADS_COMPLETED,
          destroyPlayer
        );

        adsManager.addEventListener(
          google.ima.AdErrorEvent.Type.AD_ERROR,
          destroyPlayer
        );

        try {
          adsManager.init(
            container.offsetWidth,
            container.offsetHeight,
            google.ima.ViewMode.NORMAL
          );
          adsManager.start();
        } catch(e) {
          destroyPlayer();
        }
      }
    );

    adsLoader.addEventListener(
      google.ima.AdErrorEvent.Type.AD_ERROR,
      destroyPlayer
    );

    function requestAd() {
      adDisplayContainer.initialize();
      const adsRequest = new google.ima.AdsRequest();
      adsRequest.adTagUrl = VAST_TAG + "&correlator=" + Date.now();
      adsRequest.linearAdSlotWidth = container.offsetWidth;
      adsRequest.linearAdSlotHeight = container.offsetHeight;
      adsLoader.requestAds(adsRequest);
    }

    /* ================= VIEWPORT TRIGGER ================= */

    // initial ad request at 25% visible
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting && entry.intersectionRatio >= 0.25) {
          observer.disconnect();
          requestAd();
        }
      });
    }, { threshold: 0.25 });

    observer.observe(container);

    /* ================= VIDEO VIEWABILITY PAUSE ================= */

    function checkViewability() {
      const rect = container.getBoundingClientRect();
      const vh = window.innerHeight || document.documentElement.clientHeight;
      const visibleHeight = Math.min(rect.bottom, vh) - Math.max(rect.top, 0);
      const ratio = visibleHeight / rect.height;

      if (ratio >= 0.5) {
        if (video.paused && !video.ended) {
          video.play().catch(()=>{});
        }
      } else {
        if (!video.paused) {
          video.pause();
        }
      }
    }

    setInterval(checkViewability, 600);
    window.addEventListener("scroll", checkViewability, { passive:true });
    window.addEventListener("resize", checkViewability);
    document.addEventListener("visibilitychange", checkViewability);

    /* ================= MUTE ================= */

    muteBtn.onclick = function () {
      video.muted = !video.muted;
      try { if (adsManager) adsManager.setVolume(video.muted ? 0 : 1); } catch(e){}
      muteBtn.innerHTML = video.muted ? "🔇" : "🔊";
    };

    /* ================= CLOSE ================= */

    closeBtn.onclick = destroyPlayer;

    function destroyPlayer() {
      try { adsManager && adsManager.destroy(); } catch(e){}
      container.remove();
      window.__MC_OUTSTREAM__ = false;
    }

  }

})();
