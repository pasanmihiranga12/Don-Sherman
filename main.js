// ============================================================
// DON SHERMAN — THE SINGING CHEF
// Motion system: Lenis + GSAP + ScrollTrigger + SplitType
// ============================================================

gsap.registerPlugin(ScrollTrigger);

const isTouch = window.matchMedia('(max-width: 860px)').matches || 'ontouchstart' in window;
const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------------- Preloader ---------------- */
const plFill = document.getElementById('plFill');
const plPct = document.getElementById('plPct');
const plLogoImg = document.getElementById('plLogoImg');
const preloader = document.getElementById('preloader');

let progress = 0;
const images = Array.from(document.images);
const totalAssets = Math.max(images.length, 1);
let loaded = 0;

// logo fades/scales in cleanly as loading progresses — no wipe/mask,
// so there's never a half-cut broken-looking frame
gsap.to(plLogoImg, {opacity:1, scale:1, duration:1.1, ease:'power2.out', delay:.15});

function updatePreloaderVisual(pct){
  plFill.style.width = pct + '%';
  plPct.textContent = pct + '%';
}

function bumpProgress(){
  loaded++;
  const pct = Math.min(100, Math.round((loaded/totalAssets)*100));
  progress = pct;
  updatePreloaderVisual(pct);
  if(loaded >= totalAssets){ finishPreload(); }
}

images.forEach(img=>{
  if(img.complete){ bumpProgress(); }
  else{
    img.addEventListener('load', bumpProgress);
    img.addEventListener('error', bumpProgress);
  }
});

// fallback in case nothing loads quickly
setTimeout(()=>{ if(loaded < totalAssets){ finishPreload(); } }, 4000);

let preloadDone = false;
function finishPreload(){
  if(preloadDone) return;
  preloadDone = true;
  updatePreloaderVisual(100);
  const tl = gsap.timeline({
    delay:.35,
    onComplete:()=>{
      preloader.style.display='none';
      document.body.style.overflow='';
      initSite();
    }
  });
  tl.to('.pl-logo-wrap, .pl-bar, .pl-pct, .pl-tag', {opacity:0, y:-14, duration:.5, ease:'power2.in', stagger:.04})
    .to(preloader, {opacity:0, duration:.5, ease:'power2.out'}, '-=.2');
}

/* ---------------- Lenis smooth scroll ---------------- */
let lenis;
function initLenis(){
  if(prefersReduced) return;
  lenis = new Lenis({
    duration: 1.1,
    easing: (t)=> 1 - Math.pow(1-t, 3),
    smoothWheel: true,
    touchMultiplier: 1.2,
  });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time)=>{ lenis.raf(time*1000); });
  gsap.ticker.lagSmoothing(0);
}

/* ---------------- Custom cursor ---------------- */
function initCursor(){
  if(isTouch) return;
  const cursor = document.getElementById('cursor');
  const label = document.getElementById('cursor-label');
  let mx=0,my=0,cx=0,cy=0;

  window.addEventListener('mousemove', e=>{ mx=e.clientX; my=e.clientY; });

  gsap.ticker.add(()=>{
    cx += (mx-cx)*0.18;
    cy += (my-cy)*0.18;
    cursor.style.transform = `translate(${cx}px,${cy}px) translate(-50%,-50%)`;
    label.style.transform = `translate(${cx}px,${cy}px) translate(-50%,-50%)`;
  });

  const setState = (text)=>{
    if(text){
      cursor.style.width='0'; cursor.style.height='0';
      label.textContent = text;
      gsap.to(label, {opacity:1, duration:.25});
    } else {
      cursor.style.width='14px'; cursor.style.height='14px';
      gsap.to(label, {opacity:0, duration:.25});
    }
  };

  document.querySelectorAll('[data-lightbox]').forEach(el=>{
    el.addEventListener('mouseenter', ()=> setState('View'));
    el.addEventListener('mouseleave', ()=> setState(null));
  });
  document.querySelectorAll('a, button').forEach(el=>{
    el.addEventListener('mouseenter', ()=>{
      gsap.to(cursor, {width:34, height:34, duration:.25});
    });
    el.addEventListener('mouseleave', ()=>{
      gsap.to(cursor, {width:14, height:14, duration:.25});
    });
  });
}

/* ---------------- Magnetic buttons ---------------- */
function initMagnetic(){
  if(isTouch) return;
  document.querySelectorAll('.mag-btn').forEach(btn=>{
    btn.addEventListener('mousemove', e=>{
      const r = btn.getBoundingClientRect();
      const relX = e.clientX - r.left - r.width/2;
      const relY = e.clientY - r.top - r.height/2;
      gsap.to(btn, {x: relX*0.35, y: relY*0.5, duration:.4, ease:'power2.out'});
    });
    btn.addEventListener('mouseleave', ()=>{
      gsap.to(btn, {x:0, y:0, duration:.5, ease:'elastic.out(1,0.4)'});
    });
  });
}

/* ---------------- Text splitting + reveals ---------------- */
/* ---------------- About: staggered role list + count-up stats ---------------- */
function initAboutRoles(){
  const rows = gsap.utils.toArray('.role-row');
  if(!rows.length) return;

  ScrollTrigger.create({
    trigger: '.role-list',
    start: 'top 85%',
    once: true,
    onEnter: ()=>{
      gsap.to(rows, {
        opacity:1, y:0, duration:.7, ease:'power3.out', stagger:.1
      });
      // count-up the numeric stats (33+ YRS, 10 YRS) once the rows
      // holding them start revealing
      document.querySelectorAll('.count-up').forEach(el=>{
        const target = parseInt(el.getAttribute('data-count'), 10) || 0;
        const obj = {val:0};
        gsap.to(obj, {
          val: target, duration:1.3, ease:'power2.out', delay:.2,
          onUpdate: ()=>{ el.textContent = Math.round(obj.val); }
        });
      });
    }
  });
}

function initTextReveals(){
  document.querySelectorAll('.split').forEach(el=>{
    const lines = el.querySelectorAll('.line');
    if(lines.length){
      gsap.set(lines, {yPercent:110, opacity:0});
    }
  });

  // reveal-up generic paragraphs/headings
  document.querySelectorAll('.reveal-up').forEach(el=>{
    gsap.set(el, {y:36, opacity:0});
    ScrollTrigger.create({
      trigger: el,
      start:'top 88%',
      onEnter:()=> gsap.to(el, {y:0, opacity:1, duration:1, ease:'power3.out'}),
      once:true
    });
  });

  document.querySelectorAll('.split').forEach(el=>{
    const lines = el.querySelectorAll('.line');
    if(!lines.length) return;
    ScrollTrigger.create({
      trigger: el,
      start:'top 90%',
      onEnter:()=> gsap.to(lines, {yPercent:0, opacity:1, duration:1, ease:'power4.out', stagger:.08}),
      once:true
    });
  });
}

/* ---------------- Hero sequence ---------------- */
function heroIntro(){
  const tl = gsap.timeline({defaults:{ease:'power4.out'}});
  tl.fromTo('#hero .hero-photo-stage', {opacity:0, scale:1.02}, {opacity:1, scale:1, duration:1.4}, 0)
    .to('#hero .hero-eyebrow .line', {yPercent:0, opacity:1, duration:.9}, .35)
    .to('#hero h1 .line', {yPercent:0, opacity:1, duration:1, stagger:.09}, .45)
    .fromTo('#hero .hero-sub', {opacity:0,y:16}, {opacity:1,y:0,duration:.8}, .9)
    .fromTo('#hero .hero-meta', {opacity:0,y:16}, {opacity:1,y:0,duration:.8}, 1.0)
    .fromTo('.scroll-cue', {opacity:0}, {opacity:1,duration:.6}, 1.2)
    .fromTo('#hero .hero-hint', {opacity:0}, {opacity:1,duration:.6}, 1.2);
}

/* ---------------- Hero fluid reveal ----------------
   Real-time WebGL fluid simulation (Navier-Stokes / Stable Fluids).
   The cursor injects velocity + dye into the sim; the resulting fluid
   density blends between the chef and singer photographs. Runs on its
   own render loop tied to the GSAP ticker. Falls back to a static
   photo if WebGL is unavailable. */
function initHeroFluid(){
  const stage = document.querySelector('.hero-photo-stage');
  const canvas = document.getElementById('fluidCanvas');
  const fallback = document.getElementById('heroFallback');
  const hint = document.getElementById('heroHint');
  const hintOff = hint ? hint.querySelector('.off') : null;
  const hintOn = hint ? hint.querySelector('.on') : null;
  if(!stage || !canvas || typeof THREE === 'undefined' || typeof FluidReveal === 'undefined') return;

  let fluid;
  let texturesReady = false;
  try{
    fluid = new FluidReveal(canvas, {
      simRes: isTouch ? 96 : 128,
      dyeRes: isTouch ? 480 : 720,
      splatRadius: 0.35, // Shrunk from 1.05 down to 0.35 for a much tighter manual brush
      splatForce: 6200,
      dissipation: 0.94,
      velocityDissipation: 0.94,
      curlStrength: 0,
      pressureIterations: 20,
      baseTexUrl: 'images/chef-don.webp',
      revealTexUrl: 'images/singer-don.webp',
      onReady: ()=>{ texturesReady = true; },
      onError: (which, err)=>{
        console.warn(`Fluid reveal: "${which}" photo failed to load — keeping the static photo visible instead. ` +
          `This usually means the page was opened directly as a file (file://) rather than through a local ` +
          `server or real hosting — WebGL blocks texture loading in that case. Serve the folder over http(s) instead.`, err);
      }
    });
  } catch(e){
    console.warn('Fluid reveal unavailable (WebGL failed to initialize) — showing static photo instead.', e);
    return;
  }

  window.__heroFluid = fluid;

  function resize(){
    const rect = stage.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    fluid.resize(Math.max(2,Math.floor(rect.width*dpr)), Math.max(2,Math.floor(rect.height*dpr)));
  }
  resize();
  window.addEventListener('resize', resize);

  let lastX = 0.5, lastY = 0.42, lastMoveTime = performance.now();
  let idleAngle = Math.random()*10;
  let lastIdleSplat = 0;
  let revealed = false;

  function handleMove(clientX, clientY){
    const rect = stage.getBoundingClientRect();
    const x = (clientX - rect.left) / rect.width;
    const y = (clientY - rect.top) / rect.height;
    const dx = (x - lastX) * 7;
    const dy = (y - lastY) * 7;
    lastX = x; lastY = y;
    lastMoveTime = performance.now();
    // WebGL's UV space has Y=0 at the bottom; screen/mouse coordinates
    // have Y=0 at the top — flip both position and velocity Y so the
    // fluid actually lands where the cursor visually is
    fluid.splat(x, 1 - y, dx, -dy, rect.width / rect.height);
    if(!revealed){ revealed = true; }
    if(hintOff && hintOn){
      hintOff.style.color = 'rgba(242,239,233,0.4)';
      hintOn.style.color = 'var(--gold)';
    }
  }

  if(!isTouch){
    stage.addEventListener('mousemove', e => handleMove(e.clientX, e.clientY));
  } else {
    stage.addEventListener('touchmove', e=>{
      if(e.touches[0]) handleMove(e.touches[0].clientX, e.touches[0].clientY);
    }, {passive:true});
  }

  let readyShown = false;
  let lastHardClear = performance.now();
  gsap.ticker.add(()=>{
    const now = performance.now();
    const rect = stage.getBoundingClientRect();
    const aspect = rect.width / (rect.height || 1);

    // idle autonomous flow: Invisible mouse (Zigzag / Sigsak swipes, strict breaks, small brush)
    if(!window.__disableIdle && now - lastMoveTime > 1500){
      if (!window.__autoState) {
        window.__autoState = { phase: 'wait', lastTime: now, startX: 0.5, startY: 0.5, endX: 0.5, endY: 0.5, prevX: 0.5, prevY: 0.5 };
      }
      
      const state = window.__autoState;
      const elapsed = now - state.lastTime;

      // Phase 1: Take a strict 2.5 second break
      if (state.phase === 'wait' && elapsed > 2500) { 
        state.phase = 'swipe';
        state.lastTime = now;
        
        state.startX = 0.4 + Math.random() * 0.2;
        state.startY = 0.15 + Math.random() * 0.2;
        state.endX = state.startX;
        state.endY = 0.65 + Math.random() * 0.2;
        
        // 50% chance to wipe bottom-to-top
        if (Math.random() > 0.5) {
          const ty = state.startY; state.startY = state.endY; state.endY = ty;
        }
        
        state.prevX = state.startX;
        state.prevY = state.startY;
      } 
      // Phase 2: Do a fast zigzag wipe
      else if (state.phase === 'swipe') {
        const duration = 650; // 0.65 second fast wipe
        if (elapsed > duration) {
          state.phase = 'wait';
          state.lastTime = now;
        } else {
          const prog = elapsed / duration;
          const easeProg = 0.5 - Math.cos(prog * Math.PI) / 2; 
          
          // ZIGZAG MATH: Creates the "Sigsak" side-to-side motion
          const zigZagWidth = 0.2; // How wide the zigzag swings
          const zigZagSpeed = 3.5; // How many zigs and zags it makes
          const zigZagOffset = Math.sin(prog * Math.PI * zigZagSpeed) * zigZagWidth;

          const currentX = state.startX + (state.endX - state.startX) * easeProg + zigZagOffset;
          const currentY = state.startY + (state.endY - state.startY) * easeProg;

          const dx = (currentX - state.prevX) * 7;
          const dy = (currentY - state.prevY) * 7;

          // Brush strength is 0.7 here to keep the auto-reveal small and sharp
          fluid.splat(currentX, 1 - currentY, dx, -dy, aspect, 0.7);

          state.prevX = currentX;
          state.prevY = currentY;
        }
      }
    }

    fluid.step(1/60, aspect);

    // hard safety reset — wipes the fluid state completely every few
    // seconds. Guarantees it is physically impossible for density to
    // ever build up into a full-canvas overlay no matter what, since
    // state can never persist longer than this interval
    if(now - lastHardClear > 5000){
      lastHardClear = now;
      fluid.clear();
    }

    // only swap away from the static fallback photo once the WebGL
    // textures have actually confirmed loaded — otherwise the canvas
    // would show as blank/black and the hero would go empty
    if(!readyShown && texturesReady){
      readyShown = true;
      canvas.classList.add('is-ready');
      gsap.to(fallback, {opacity:0, duration:.6, delay:.2});
    }
  });
}


/* ---------------- Hero scroll fade (content only) ---------------- */
function heroScrollFade(){
  gsap.to('#hero .hero-content', {
    yPercent: 18, opacity:.3,
    scrollTrigger:{ trigger:'#hero', start:'top top', end:'bottom top', scrub:1 }
  });
}

/* ---------------- Generic image parallax ---------------- */
function initImageParallax(){
  document.querySelectorAll('[data-parallax-img] img').forEach(img=>{
    gsap.fromTo(img, {yPercent:-8}, {
      yPercent:8, ease:'none',
      scrollTrigger:{ trigger: img.closest('[data-parallax-img]'), start:'top bottom', end:'bottom top', scrub:1 }
    });
  });
}

/* ---------------- Gallery: staggered curtain reveal + drifting parallax ---------------- */
function initGalleryCarousel(){
  const stage = document.getElementById('gCarouselStage');
  const ring = document.getElementById('gCarouselRing');
  const prevBtn = document.getElementById('gPrev');
  const nextBtn = document.getElementById('gNext');
  if(!stage || !ring) return;

  const cards = Array.from(ring.querySelectorAll('.g-carousel-card'));
  const count = cards.length;
  if(!count) return;

  const angleStep = 360 / count;
  let radius = 460;
  // rawIndex accumulates freely (can go negative or past count) so
  // rotation is always continuous — current (wrapped 0..count-1) is
  // only derived from it for display/lightbox purposes. This is what
  // stops the "spins fast at the wrap point" bug: previously the code
  // snapped rotation to a fixed value for the wrapped index, which
  // meant going from the last card back to the first jumped almost a
  // full turn instead of taking one small step.
  let rawIndex = 0;
  let current = 0;

  function layout(){
    // radius scales with the actual card size so the ring never looks
    // too tight or too spread out at different viewport widths
    const cardW = cards[0].offsetWidth;
    radius = Math.round((cardW/2) / Math.tan(Math.PI/count)) + 90;
    cards.forEach((card, i)=>{
      card.style.transform = `rotateY(${i*angleStep}deg) translateZ(${radius}px)`;
    });
    updateRing(false);
  }

  function updateRing(animate){
    ring.style.transition = animate ? 'transform .7s cubic-bezier(.22,1,.36,1)' : 'none';
    ring.style.transform = `translateZ(-${radius}px) rotateY(${-rawIndex*angleStep}deg)`;
    cards.forEach((card, i)=> card.classList.toggle('is-front', i===current));
  }

  function goTo(newRawIndex, animate=true){
    rawIndex = newRawIndex;
    current = ((rawIndex % count) + count) % count;
    updateRing(animate);
  }

  // for a direct card click, step by the SHORTEST wrapped distance
  // from the current card rather than jumping straight to that card's
  // fixed angle (same fast-spin problem as above)
  function goToShortest(targetWrapped){
    let delta = targetWrapped - current;
    if(delta > count/2) delta -= count;
    if(delta < -count/2) delta += count;
    goTo(rawIndex + delta);
  }

  prevBtn?.addEventListener('click', ()=> goTo(rawIndex-1));
  nextBtn?.addEventListener('click', ()=> goTo(rawIndex+1));

  cards.forEach((card, i)=>{
    card.addEventListener('click', ()=>{
      if(i===current){
        const url = card.getAttribute('data-lightbox');
        if(url) window.__openLightbox?.(url);
      } else {
        goToShortest(i);
      }
    });
  });

  // wheel-to-rotate — a real "scroll to rotate" interaction on the
  // carousel itself, not the whole page. Small threshold + debounce so
  // one scroll gesture advances one card at a time rather than spinning
  // wildly.
  let wheelLocked = false;
  stage.addEventListener('wheel', e=>{
    e.preventDefault();
    if(wheelLocked) return;
    if(Math.abs(e.deltaY) < 12 && Math.abs(e.deltaX) < 12) return;
    wheelLocked = true;
    goTo(rawIndex + (e.deltaY > 0 || e.deltaX > 0 ? 1 : -1));
    setTimeout(()=> wheelLocked = false, 550);
  }, {passive:false});

  // drag / swipe to rotate
  let dragging = false, dragStartX = 0;
  stage.addEventListener('pointerdown', e=>{ dragging = true; dragStartX = e.clientX; });
  window.addEventListener('pointerup', e=>{
    if(!dragging) return;
    dragging = false;
    const dx = e.clientX - dragStartX;
    if(Math.abs(dx) > 40) goTo(rawIndex + (dx < 0 ? 1 : -1));
  });

  window.addEventListener('resize', layout);
  layout();
}

/* ---------------- Culinary horizontal scroll ---------------- */
function initFanGallery(){
  const wrap = document.getElementById('fanWrap');
  if(!wrap) return;
  const cards = Array.from(wrap.querySelectorAll('.fan-card'));
  const hint = document.getElementById('culinaryHint');
  const dotsWrap = document.getElementById('fanDots');
  if(!cards.length) return;

  function setActive(card){
    cards.forEach(c=> c.classList.toggle('is-active', c===card));
    if(dotsWrap){
      Array.from(dotsWrap.children).forEach((d,i)=> d.classList.toggle('is-active', cards[i]===card));
    }
  }
  function clearActive(){
    cards.forEach(c=> c.classList.remove('is-active'));
  }

  if(!isTouch){
    cards.forEach(card=>{
      card.addEventListener('mouseenter', ()=> setActive(card));
    });
    wrap.addEventListener('mouseleave', clearActive);
  } else {
    if(hint) hint.textContent = 'Tap to browse';
    // build tap-through dot navigation so all photos are reachable
    if(dotsWrap){
      cards.forEach((card, i)=>{
        const dot = document.createElement('button');
        dot.setAttribute('aria-label', 'Show photo '+(i+1));
        if(i===0) dot.classList.add('is-active');
        dot.addEventListener('click', ()=> setActive(card));
        dotsWrap.appendChild(dot);
      });
    }
    setActive(cards[0]);
  }
}

/* ---------------- Rhythm waveform ---------------- */
function initWaveform(){
  const wf = document.getElementById('waveform');
  if(!wf) return;
  const bars = 48;
  for(let i=0;i<bars;i++){
    const bar = document.createElement('div');
    bar.className='bar';
    const h = 12 + Math.round(Math.abs(Math.sin(i*0.4))*50 + Math.random()*10);
    bar.style.height = h+'px';
    wf.appendChild(bar);
  }
  gsap.set(wf.children, {scaleY:0.25, transformOrigin:'center'});
  ScrollTrigger.create({
    trigger: wf, start:'top 85%',
    onEnter:()=>{
      gsap.to(wf.children, {scaleY:1, duration:1, ease:'elastic.out(1,0.5)', stagger:{each:0.012, from:'center'}});
    },
    once:true
  });
}

/* ---------------- Performance pinned reveal ---------------- */
function initPerformanceReveal(){
  const wrap = document.querySelector('.perf-spacer');
  const reveal = document.querySelector('.perf-reveal');
  const bgs = gsap.utils.toArray('.perf-bg');
  const lines = gsap.utils.toArray('[data-pl]');
  if(!wrap || !lines.length || !bgs.length) return;

  gsap.set(bgs, {opacity:0, scale:1.22});
  gsap.set(bgs[0], {opacity:1});
  gsap.set(lines, {opacity:0, scale:1.5, filter:'blur(18px)'});

  const tl = gsap.timeline({
    scrollTrigger:{
      trigger: wrap,
      start:'top top',
      end:'bottom bottom',
      scrub:1,
      // GSAP-driven pin (not CSS position:sticky) so the pinned view
      // releases at EXACTLY 'bottom bottom' — matching this timeline's
      // own scroll range precisely. A CSS-sticky + separate scroll-scrub
      // range previously fell out of sync, unsticking early and leaving
      // a long stretch of bare black background before the next section.
      pin: reveal,
      pinSpacing: false,
    }
  });

  // each of the three lines gets its OWN matching photo, crossfading
  // together — Cooks/Performs/Sings each land on a different real shot
  // instead of one static image sitting behind all three. Text punches
  // in from a soft blur + oversized scale (camera focus-pull), rather
  // than a plain fade — a more physical, "wow" entrance.
  const step = 1.0;
  lines.forEach((line, i)=>{
    const start = i * step;

    // background crossfade: bg[i] rises to full opacity as this line
    // starts, previous bg fades under it
    tl.to(bgs[i], {opacity:1, scale:1, duration:.7, ease:'power2.out'}, start);
    if(i > 0){
      tl.to(bgs[i-1], {opacity:0, duration:.7, ease:'power2.out'}, start);
    }

    // text: blur+scale punch-in, hold, then a quick blur-out as the
    // next line takes over
    tl.to(line, {opacity:1, scale:1, filter:'blur(0px)', duration:.5, ease:'power3.out'}, start);
    if(i < lines.length-1){
      tl.to(line, {opacity:0, scale:.82, filter:'blur(14px)', duration:.45, ease:'power2.in'}, start + step - 0.3);
    }
  });

  // hold the final frame, then a gentle late dim right at the very end
  tl.to(bgs[bgs.length-1], {opacity:.6, duration:.5}, tl.duration());
}

/* ---------------- Timeline fill ---------------- */
function initTimelineFill(){
  const fill = document.getElementById('timelineFill');
  const timeline = document.querySelector('.timeline');
  if(!fill || !timeline) return;
  gsap.to(fill, {
    height:'100%', ease:'none',
    scrollTrigger:{ trigger: timeline, start:'top 70%', end:'bottom 80%', scrub:1 }
  });

  gsap.utils.toArray('.t-item').forEach(item=>{
    gsap.set(item, {opacity:.25});
    ScrollTrigger.create({
      trigger:item, start:'top 75%', end:'top 40%', scrub:1,
      onUpdate:self=> gsap.set(item,{opacity: .25 + self.progress*.75})
    });
    const dot = item.querySelector('.t-dot');
    ScrollTrigger.create({
      trigger:item, start:'top 65%',
      onEnter:()=> gsap.to(dot, {backgroundColor:'#c9a227', duration:.4}),
    });
  });
}

/* ---------------- Gallery hover tilt (desktop) ---------------- */
function initGalleryTilt(){
  if(isTouch) return;
  document.querySelectorAll('.g-item').forEach(item=>{
    item.addEventListener('mousemove', e=>{
      const r = item.getBoundingClientRect();
      const relX = (e.clientX - r.left)/r.width - 0.5;
      const relY = (e.clientY - r.top)/r.height - 0.5;
      gsap.to(item.querySelector('img'), {
        rotate: relX*3, scale:1.08, duration:.4, ease:'power2.out',
        x: relX*10, y: relY*10
      });
    });
    item.addEventListener('mouseleave', ()=>{
      gsap.to(item.querySelector('img'), {rotate:0, scale:1, x:0, y:0, duration:.6, ease:'power3.out'});
    });
  });
}

/* ---------------- Lightbox ---------------- */
function initLightbox(){
  const lb = document.getElementById('lightbox');
  const lbImg = document.getElementById('lightboxImg');
  const closeBtn = document.getElementById('lightboxClose');

  function openLb(src, alt){
    lbImg.src = src;
    lbImg.alt = alt || '';
    lb.classList.add('active');
    if(lenis) lenis.stop();
  }
  window.__openLightbox = openLb;

  // carousel cards handle their own click logic (rotate vs open) in
  // initGalleryCarousel — excluded here so a side-card click doesn't
  // also fire this generic handler and open the lightbox underneath it
  document.querySelectorAll('[data-lightbox]:not(.g-carousel-card)').forEach(el=>{
    el.addEventListener('click', ()=>{
      openLb(el.getAttribute('data-lightbox'), el.querySelector('img')?.alt);
    });
  });

  function closeLb(){
    lb.classList.remove('active');
    if(lenis) lenis.start();
  }
  closeBtn.addEventListener('click', closeLb);
  lb.addEventListener('click', e=>{ if(e.target===lb) closeLb(); });
  window.addEventListener('keydown', e=>{ if(e.key==='Escape') closeLb(); });
}

/* ---------------- Nav blend on scroll (subtle) ---------------- */
function initNavScroll(){
  ScrollTrigger.create({
    trigger: document.body,
    start:'top top',
    end:'bottom bottom',
    onUpdate: self=>{
      // placeholder for future nav state changes
    }
  });
}

/* ---------------- Smooth anchor scroll ---------------- */
function initAnchors(){
  document.querySelectorAll('a[href^="#"]:not(.menu-item)').forEach(a=>{
    a.addEventListener('click', e=>{
      const id = a.getAttribute('href');
      const target = document.querySelector(id);
      if(!target) return;
      e.preventDefault();
      if(lenis){ lenis.scrollTo(target, {offset:-20, duration:1.4}); }
      else { target.scrollIntoView({behavior:'smooth'}); }
    });
  });
}

/* ---------------- Init sequence ---------------- */
/* ---------------- Full-screen menu overlay ---------------- */
function initMenuOverlay(){
  const toggle = document.getElementById('menuToggle');
  const overlay = document.getElementById('menuOverlay');
  if(!toggle || !overlay) return;

  const items = overlay.querySelectorAll('.menu-item');
  const sideEls = overlay.querySelectorAll('.menu-side > *');
  gsap.set(items, {yPercent:110});
  gsap.set(sideEls, {opacity:0, y:14});

  let open = false;
  function openMenu(){
    open = true;
    toggle.classList.add('is-open');
    toggle.setAttribute('aria-expanded','true');
    overlay.classList.add('is-open');
    document.getElementById('site-nav')?.classList.add('menu-is-open');
    if(lenis) lenis.stop();
    gsap.timeline({delay:.25})
      .to(items, {yPercent:0, duration:.85, ease:'power4.out', stagger:.07})
      .to(sideEls, {opacity:1, y:0, duration:.6, ease:'power2.out', stagger:.06}, '-=.5');
  }
  function closeMenu(){
    open = false;
    toggle.classList.remove('is-open');
    toggle.setAttribute('aria-expanded','false');
    overlay.classList.remove('is-open');
    document.getElementById('site-nav')?.classList.remove('menu-is-open');
    if(lenis) lenis.start();
    gsap.set(items, {yPercent:110});
    gsap.set(sideEls, {opacity:0, y:14});
  }

  toggle.addEventListener('click', ()=> open ? closeMenu() : openMenu());
  overlay.querySelectorAll('.menu-item').forEach(el=>{
    el.addEventListener('click', e=>{
      e.preventDefault();
      const target = document.querySelector(el.getAttribute('href'));
      closeMenu();
      if(target){
        // lenis must be resumed (closeMenu just called lenis.start())
        // before scrollTo has any effect — a short delay guarantees
        // the resume has taken effect first
        setTimeout(()=>{
          if(lenis) lenis.scrollTo(target, {offset:-20, duration:1.4});
          else target.scrollIntoView({behavior:'smooth'});
        }, 50);
      }
    });
  });
  overlay.querySelectorAll('.menu-social').forEach(el=>{
    el.addEventListener('click', closeMenu);
  });
  window.addEventListener('keydown', e=>{ if(e.key==='Escape' && open) closeMenu(); });
}

/* ---------------- Mobile Scroll Lock ---------------- */
function initMobileLock(){
  const lockBtn = document.getElementById('heroLockBtn');
  const lockLabel = lockBtn ? lockBtn.querySelector('.lock-label') : null;
  if(!lockBtn) return;

  let isLocked = false;
  lockBtn.addEventListener('click', ()=>{
    isLocked = !isLocked;
    if(isLocked){
      document.body.style.overflow = 'hidden';
      if(lenis) lenis.stop();
      lockBtn.classList.add('is-locked');
      if(lockLabel) lockLabel.textContent = 'Unlock';
    } else {
      document.body.style.overflow = '';
      if(lenis) lenis.start();
      lockBtn.classList.remove('is-locked');
      if(lockLabel) lockLabel.textContent = 'Tap to Lock';
    }
  });
}

function initSite(){
  document.body.style.overflow='';
  initLenis();
  initMobileLock();
  initMagnetic();
  initTextReveals();
  initAboutRoles();
  initImageParallax();
  initGalleryCarousel();
  initFanGallery();
  initWaveform();
  initPerformanceReveal();
  initTimelineFill();
  initGalleryTilt();
  initLightbox();
  initNavScroll();
  initAnchors();
  initMenuOverlay();
  heroIntro();
  initHeroFluid();
  if(!prefersReduced){ heroScrollFade(); }

  ScrollTrigger.refresh();
  window.addEventListener('resize', ()=> ScrollTrigger.refresh());
}

document.body.style.overflow='hidden';