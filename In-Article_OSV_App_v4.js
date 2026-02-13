(function () {

  if (window.__MC_OUTSTREAM__) return;
  window.__MC_OUTSTREAM__ = true;

  const doc = document;

  /* ================= CONFIG ================= */

  const CONFIG = {
    width: 340,
    height: 190,
    insertAfterParagraph: 3,
    viewabilityThreshold: 0.5,
    contentVideo: "https://www.w3schools.com/html/mov_bbb.mp4",
    adTag: "https://pubads.g.doubleclick.net/gampad/ads?iu=/1039154/Inhouse_Video_1_3&output=vast&env=vp&gdfp_req=1&unviewed_position_start=1&impl=s&plcmt=1&vpos=preroll&sz=640x360&ciu_szs=640x360"
  };

  const correlator = Date.now();

  /* ================= STATE ================= */

  let adsLoader = null;
  let adsManager = null;
  let adDisplayContainer = null;

  let isViewable = false;
  let prerollRequested = false;
  let playerDestroyed = false;
  let viewTimer = null;

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
    <button id="mc-close" style="position:absolute;top:6px;left:6px;display:none;">×</button>
  `;

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
  const closeBtn = container.querySelector("#mc-close");

  video.src = CONFIG.contentVideo;
  video.muted = true;
  video.loop = false;

  video.addEventListener("playing", () => {
    container.style.opacity = "1";
    container.style.visibility = "visible";
  });

  /* ================= IMA ================= */

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
  }

  function requestAd() {

    if (prerollRequested || playerDestroyed) return;

    prerollRequested = true;

    adDisplayContainer.initialize();

    const request = new google.ima.AdsRequest();
    request.adTagUrl =
      CONFIG.adTag +
      "&correlator=" + correlator +
      "&cb=" + correlator;

    request.linearAdSlotWidth = CONFIG.width;
    request.linearAdSlotHeight = CONFIG.height;
    request.setAdWillAutoPlay(true);
    request.setAdWillPlayMuted(true);

    adsLoader.requestAds(request);
  }

  function onAdsManagerLoaded(event) {

    adsManager = event.getAdsManager(video);

    adsManager.addEventListener(
      google.ima.AdEvent.Type.CONTENT_PAUSE_REQUESTED,
      () => video.pause()
    );

    adsManager.addEventListener(
      google.ima.AdEvent.Type.CONTENT_RESUME_REQUESTED,
      () => video.play().catch(()=>{})
    );

    adsManager.addEventListener(
      google.ima.AdEvent.Type.ALL_ADS_COMPLETED,
      () => {
        video.play().catch(()=>{});
      }
    );

    adsManager.addEventListener(
      google.ima.AdErrorEvent.Type.AD_ERROR,
      onAdError
    );

    try {
      adsManager.init(CONFIG.width, CONFIG.height, google.ima.ViewMode.NORMAL);
      adsManager.start();
    } catch (e) {
      video.play().catch(()=>{});
    }

    // show close button after 5 seconds
    setTimeout(() => {
      if (!playerDestroyed) closeBtn.style.display = "block";
    }, 5000);
  }

  function onAdError() {
    video.play().catch(()=>{});
  }

  /* ================= VIEWABILITY (IAB 2s Rule) ================= */

  function setupObserver() {

    const observer = new IntersectionObserver((entries) => {

      if (playerDestroyed) return;

      const entry = entries[0];
      const visible =
        entry.intersectionRatio >= CONFIG.viewabilityThreshold;

      if (visible) {

        if (!viewTimer) {
          viewTimer = setTimeout(() => {
            isViewable = true;
            requestAd();
          }, 2000);
        }

      } else {

        clearTimeout(viewTimer);
        viewTimer = null;

        isViewable = false;

        video.pause();
        try { adsManager?.pause(); } catch(e){}
      }

    }, { threshold: [CONFIG.viewabilityThreshold] });

    observer.observe(container);
  }

  setupObserver();

  /* ================= CLOSE ================= */

  closeBtn.onclick = () => {

    playerDestroyed = true;

    try { adsManager?.destroy(); } catch(e){}
    try { adsLoader?.destroy(); } catch(e){}

    video.pause();
    container.remove();

    window.__MC_OUTSTREAM__ = false;
  };

  loadIMA();

})();
