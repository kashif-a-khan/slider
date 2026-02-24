(function () {

  if (window.__MC_OUTSTREAM_LOADED__) return;
  window.__MC_OUTSTREAM_LOADED__ = true;

  const doc = document;
  const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);

  const WIDTH  = isMobile ? 340 : 640;
  const HEIGHT = isMobile ? 190 : 360;

  const INSERT_AFTER_P = 3;
  const MIDROLL_INTERVAL = 15;
  const ENABLE_STICKY = true;

  const BTN_SIZE = isMobile ? 40 : 50;
  const BTN_LEFT_MARGIN = isMobile ? 5 : 0;

  const CONTENT_VIDEO = "https://media-moneycontrol.akamaized.net/13542031/manifest.m3u8";
  const THUMBNAIL_URL = "https://images.moneycontrol.com/images/2019/english/inters_logo.jpg";

  // Waterfall arrays
  const PREROLL_WATERFALL = [
    "https://pubads.g.doubleclick.net/gampad/ads?iu=/1039154/Inhouse_Video_1_3&description_url=https%3A%2F%2Fwww.moneycontrol.com&tfcd=0&npa=0&sz=400x300%7C640x360%7C640x480&gdfp_req=1&unviewed_position_start=1&output=vast&env=vp&vpos=preroll&impl=s&plcmt=1&vpw=640&vph=360",
    "https://pubads.g.doubleclick.net/gampad/ads?iu=/1039154/Inhouse_Video_1_3&description_url=https%3A%2F%2Fwww.moneycontrol.com&tfcd=0&npa=0&sz=400x300%7C640x360%7C640x480&gdfp_req=1&unviewed_position_start=1&output=vast&env=vp&vpos=preroll&impl=s&plcmt=1&vpw=640&vph=360",
    "https://pubads.g.doubleclick.net/gampad/ads?iu=/1039154/Inhouse_Video_1_3&description_url=https%3A%2F%2Fwww.moneycontrol.com&tfcd=0&npa=0&sz=400x300%7C640x360%7C640x480&gdfp_req=1&unviewed_position_start=1&output=vast&env=vp&vpos=preroll&impl=s&plcmt=1&vpw=640&vph=360"
  ];
  const MIDROLL_WATERFALL = [
    "https://pubads.g.doubleclick.net/gampad/ads?iu=/1039154/Inhouse_Video_1_4&description_url=https%3A%2F%2Fwww.moneycontrol.com&tfcd=0&npa=0&sz=400x300%7C640x360%7C640x480&gdfp_req=1&unviewed_position_start=1&output=vast&env=vp&vpos=midroll&impl=s&plcmt=1&vpw=640&vph=360",
    "https://pubads.g.doubleclick.net/gampad/ads?iu=/1039154/Inhouse_Video_1_4&description_url=https%3A%2F%2Fwww.moneycontrol.com&tfcd=0&npa=0&sz=400x300%7C640x360%7C640x480&gdfp_req=1&unviewed_position_start=1&output=vast&env=vp&vpos=midroll&impl=s&plcmt=1&vpw=640&vph=360",
    "https://pubads.g.doubleclick.net/gampad/ads?iu=/1039154/Inhouse_Video_1_4&description_url=https%3A%2F%2Fwww.moneycontrol.com&tfcd=0&npa=0&sz=400x300%7C640x360%7C640x480&gdfp_req=1&unviewed_position_start=1&output=vast&env=vp&vpos=midroll&impl=s&plcmt=1&vpw=640&vph=360"
  ];

  let prerollIndex = 0;
  let midrollIndex = 0;

  let adsLoader = null, adsManager = null, adc = null;
  let lastMidrollTime = 0, midrollPlaying = false, adPlaying = false, playerKilled = false, isPreroll = true;
  let viewable = false, adsManagerReady = false;

  // Container
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
    pointer-events:auto;
  `;

  const placeholder = doc.createElement("div");
  placeholder.style.width = WIDTH + "px";
  placeholder.style.height = HEIGHT + "px";
  placeholder.style.margin = isMobile ? "15px auto 20px auto" : "15px auto";
  placeholder.style.display = "none";

  // Inner HTML
  container.innerHTML = `
    <div id="mc-thumb" style="
  position:absolute;
  top:50%;
  left:0;
  transform:translateY(-50%);
  width:100%;
  height:100%;
  display:flex;
  align-items:center;
  justify-content:center;
  background:#000;
  border-radius:8px;
  z-index:2001;
">
  <img src="${THUMBNAIL_URL}" style="
      max-width:90%;
      max-height:90%;
      object-fit:contain;
      pointer-events:none;
      user-select:none;
  ">
</div>
	

    <video id="mc-video" playsinline muted style="
      width:100%; height:100%; background:transparent; opacity:0; border-radius:8px;">
    </video>

    <div id="mc-ad-layer" style="
      position:absolute; top:0; left:0;
      width:100%; height:100%;
      z-index:1000;"></div>

    <button id="mc-close" style="
      position:absolute; top:8px; left:${BTN_LEFT_MARGIN + 8}px;
      width:${BTN_SIZE}px; height:${BTN_SIZE}px;
      border:none; border-radius:50%;
      background:rgba(0,0,0,0.6);
      display:none; cursor:pointer; z-index:2000;
      display:flex; align-items:center; justify-content:center;
      box-shadow:0 2px 6px rgba(0,0,0,0.4);
      transition:background 0.3s, transform 0.2s;"
      onmouseover="this.style.background='rgba(0,0,0,0.8)'; this.style.transform='scale(1.1)';"
      onmouseout="this.style.background='rgba(0,0,0,0.6)'; this.style.transform='scale(1)';">
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="white" viewBox="0 0 24 24">
        <path d="M18.3 5.71a1 1 0 00-1.42 0L12 10.59 7.12 5.7A1 1 0 105.7 7.12L10.59 12l-4.88 4.88a1 1 0 101.41 1.41L12 13.41l4.88 4.88a1 1 0 001.42-1.42L13.41 12l4.88-4.88a1 1 0 000-1.41z"/>
      </svg>
    </button>

    <button id="mc-mute" style="
      position:absolute; bottom:8px; left:${BTN_LEFT_MARGIN + 8}px;
      width:${BTN_SIZE}px; height:${BTN_SIZE}px;
      border:none; border-radius:50%;
      background:rgba(0,0,0,0.6);
      display:none; cursor:pointer; z-index:2000;
      display:flex; align-items:center; justify-content:center;
      box-shadow:0 2px 6px rgba(0,0,0,0.4);
      transition:background 0.3s, transform 0.2s;"
      onmouseover="this.style.background='rgba(0,0,0,0.8)'; this.style.transform='scale(1.1)';"
      onmouseout="this.style.background='rgba(0,0,0,0.6)'; this.style.transform='scale(1)';">
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="white" viewBox="0 0 24 24">
        <path d="M16 7.41V4l-8 8h3v4h2v-4h3l-1-1.59 1-1.41zM2 9v6h4l5 5V4L6 9H2z"/>
      </svg>
    </button>
  `;

  // Inject in article
  function injectInArticle() {
    const prioritySelectors = [
      "#top_screen_news_mobile",
      ".prostocklist-tab-contents",
      ".market_bx",
      "#startup-videos-main",
      "#mainprice",
      ".sec_indice_detail"
    ];

    for (let selector of prioritySelectors) {
      const el = doc.querySelector(selector);
      if (el && el.offsetParent !== null) {
        el.after(container);
        return;
      }
    }

    const h1 = doc.querySelector("h1");
    if (!h1) { doc.body.appendChild(container); return; }

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
  const thumbnail = container.querySelector("#mc-thumb");
  adLayer.style.pointerEvents = "none";

  let hlsInstance = null;

  function loadContentVideo() {
    if (!CONTENT_VIDEO.includes(".m3u8")) { video.src = CONTENT_VIDEO; return; }
    if (video.canPlayType('application/vnd.apple.mpegurl')) { video.src = CONTENT_VIDEO; return; }

    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/hls.js@latest";
    script.onload = function() {
      if (!window.Hls || !Hls.isSupported()) return;
      hlsInstance = new Hls({ enableWorker:true, lowLatencyMode:true, backBufferLength:30 });
      hlsInstance.loadSource(CONTENT_VIDEO);
      hlsInstance.attachMedia(video);
    };
    document.head.appendChild(script);
  }

  loadContentVideo();
  video.loop = false; video.muted = true;
  video.setAttribute("muted",""); video.setAttribute("playsinline","");

  function getVPMute() { return video.muted ? 1 : 0; }

  function startAdsIfViewable() {
    if (!viewable || !adsManagerReady || playerKilled) return;
    try { adsManager.init(WIDTH, HEIGHT, google.ima.ViewMode.NORMAL); adsManager.start(); } catch(e){}
  }

  function requestAds(isMidroll) {
    if (playerKilled) return;

    const req = new google.ima.AdsRequest();
    const waterfall = isMidroll ? MIDROLL_WATERFALL : PREROLL_WATERFALL;
    const index = isMidroll ? midrollIndex : prerollIndex;

    if (!waterfall[index]) return;

    req.adTagUrl = waterfall[index] + "&vpmute=" + getVPMute() + "&correlator=" + Date.now();
    req.linearAdSlotWidth = WIDTH;
    req.linearAdSlotHeight = HEIGHT;
    req.setAdWillAutoPlay(true);
    req.plcmt = 1;

    adsLoader.requestAds(req);
  }

  function tryNextVast() {
    if (adsManager) adsManager.destroy();
    midrollPlaying = false; adPlaying = false;

    if (isPreroll) {
      prerollIndex++;
      if (prerollIndex < PREROLL_WATERFALL.length) requestAds(false);
    } else {
      midrollIndex++;
      if (midrollIndex < MIDROLL_WATERFALL.length) requestAds(true);
    }
  }

  function initIMA() {
    adc = new google.ima.AdDisplayContainer(adLayer, video);
    adsLoader = new google.ima.AdsLoader(adc);
    adsLoader.addEventListener(google.ima.AdsManagerLoadedEvent.Type.ADS_MANAGER_LOADED, onAdsManagerLoaded);
    adsLoader.addEventListener(google.ima.AdErrorEvent.Type.AD_ERROR, tryNextVast);
    adc.initialize();
    requestAds(false);
  }

  function loadIMA() {
    if (window.google && window.google.ima) { initIMA(); return; }
    const s = doc.createElement("script");
    s.src = "https://imasdk.googleapis.com/js/sdkloader/ima3.js";
    s.onload = initIMA; doc.head.appendChild(s);
  }

  loadIMA();

  // Play/pause on scroll into view
  const observer = new IntersectionObserver(entries => {
    const entry = entries[0];
    viewable = entry.intersectionRatio >= 0.1;

    if (viewable && adsManagerReady && !playerKilled) startAdsIfViewable();
    if (!adPlaying && !isPreroll) { if (viewable) video.play().catch(()=>{}); else video.pause(); }
  }, { threshold: 0.1 });

  observer.observe(container);

  // Hide thumbnail
  video.addEventListener("playing", () => { if(thumbnail) thumbnail.style.display="none"; video.style.opacity = 1; muteBtn.style.display="block"; });

  // Ads manager loaded
  function onAdsManagerLoaded(e) {
    adsManager = e.getAdsManager(video);
    adsManager.setVolume(video.muted ? 0 : 1);

    adsManager.addEventListener(google.ima.AdEvent.Type.STARTED, () => { adPlaying=true; if (thumbnail) thumbnail.style.display = "none"; muteBtn.style.display = "block"; video.pause(); adLayer.style.pointerEvents="auto"; });
    adsManager.addEventListener(google.ima.AdEvent.Type.ALL_ADS_COMPLETED, () => {
      adPlaying=false; adLayer.style.pointerEvents="none"; adsLoader.contentComplete();

      if (isPreroll) {
        // Sequential prerolls
        prerollIndex++;
        if (prerollIndex < PREROLL_WATERFALL.length) requestAds(false);
        else { isPreroll=false; video.play().catch(()=>{}); }
      } else {
        // Sequential midrolls
        midrollIndex++;
        if (midrollIndex < MIDROLL_WATERFALL.length) requestAds(true);
        else video.play().catch(()=>{});
        midrollPlaying=false;
      }
    });

    adsManagerReady = true; startAdsIfViewable();
  }

  video.addEventListener("timeupdate", () => {
    if (video.currentTime < lastMidrollTime) lastMidrollTime = 0;
    if (playerKilled || midrollPlaying || isPreroll || !viewable) return;
    if (video.currentTime - lastMidrollTime >= MIDROLL_INTERVAL) { lastMidrollTime = video.currentTime; midrollPlaying=true; requestAds(true); }
  });

  // Tab visibility
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) video.pause();
    else if (!adPlaying && !isPreroll && viewable) video.play().catch(()=>{});
  });

  // Buttons
  muteBtn.onclick = () => { const m = !video.muted; video.muted=m; if(adsManager) adsManager.setVolume(m?0:1); muteBtn.textContent=m?"🔇":"🔊"; };
  closeBtn.onclick = () => { playerKilled=true; try{adsManager?.destroy()}catch{}; try{hlsInstance?.destroy()}catch{}; video.pause(); video.src=""; container.remove(); placeholder.remove(); window.__MC_OUTSTREAM_LOADED__=false; };

})();
