// ============================================================
// FLUID REVEAL — real-time WebGL fluid simulation
// Implements the classic "Stable Fluids" (Jos Stam) technique:
// velocity advection -> vorticity confinement -> divergence ->
// pressure (Jacobi) solve -> gradient subtraction -> dye advection.
// The resulting dye density field is used to blend between two
// photographs (base + reveal) in the final composite pass.
// Requires THREE (three.min.js) to be loaded first.
// ============================================================

class FluidReveal {
  constructor(canvas, opts = {}) {
    this.canvas = canvas;
    this.simRes = opts.simRes || 128;      // velocity/pressure sim grid
    this.dyeRes = opts.dyeRes || 720;      // dye/display resolution
    this.dissipation = opts.dissipation ?? 0.985;   // dye fade per frame
    this.velocityDissipation = opts.velocityDissipation ?? 0.985;
    this.pressureDecay = opts.pressureDecay ?? 0.8;
    this.pressureIterations = opts.pressureIterations ?? 22;
    this.curlStrength = opts.curlStrength ?? 22;
    this.splatRadius = opts.splatRadius ?? 0.32;   // big coverage per splat
    this.splatForce = opts.splatForce ?? 5200;
    this.baseTexUrl = opts.baseTexUrl;
    this.revealTexUrl = opts.revealTexUrl;
    this.onReady = opts.onReady || function(){};
    this.onError = opts.onError || function(){};
    this._loadedCount = 0;
    this._errored = false;

    this.renderer = new THREE.WebGLRenderer({
      canvas, alpha:true, antialias:false, premultipliedAlpha:false,
      powerPreference:'high-performance'
    });
    this.renderer.autoClear = true;
    this.renderer.setClearColor(0x000000, 0);

    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1,1,1,-1,0,1);
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2,2));
    this.scene.add(this.quad);

    this._buildTargets();
    this._buildMaterials();
    this._loadTextures();

    this.pointer = {x:0.5, y:0.5, dx:0, dy:0, moved:false};
    this.lastSplatTime = performance.now();
  }

  _rt(w, h, type) {
    return new THREE.WebGLRenderTarget(w, h, {
      type: type || THREE.HalfFloatType,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      depthBuffer:false, stencilBuffer:false
    });
  }

  _buildTargets(){
    const s = this.simRes, d = this.dyeRes;
    this.velocity = { read:this._rt(s,s), write:this._rt(s,s) };
    this.pressure = { read:this._rt(s,s), write:this._rt(s,s) };
    this.divergence = this._rt(s,s);
    this.curl = this._rt(s,s);
    this.dye = { read:this._rt(d,d), write:this._rt(d,d) };
  }

  _swap(pair){ const t = pair.read; pair.read = pair.write; pair.write = t; }

  _loadTextures(){
    const loader = new THREE.TextureLoader();
    this.baseImgAspect = 1;
    this.revealImgAspect = 1;
    const checkReady = ()=>{
      this._loadedCount++;
      if(this._loadedCount >= 2 && !this._errored) this.onReady();
    };
    const onErr = (which)=>(err)=>{
      this._errored = true;
      this.onError(which, err);
    };
    this.baseTex = loader.load(this.baseTexUrl, tex=>{
      this.baseImgAspect = tex.image.width / tex.image.height;
      this._updateCoverScales();
      checkReady();
    }, undefined, onErr('base'));
    this.revealTex = loader.load(this.revealTexUrl, tex=>{
      this.revealImgAspect = tex.image.width / tex.image.height;
      this._updateCoverScales();
      checkReady();
    }, undefined, onErr('reveal'));
    [this.baseTex, this.revealTex].forEach(t=>{
      t.minFilter = THREE.LinearFilter;
      t.magFilter = THREE.LinearFilter;
    });
  }

  _coverScale(imgAspect){
    const canvasAspect = this._canvasAspect || 1;
    if(canvasAspect > imgAspect){
      return [1, imgAspect / canvasAspect];
    }
    return [canvasAspect / imgAspect, 1];
  }

  _updateCoverScales(){
    if(!this.matDisplay) return;
    const [bx,by] = this._coverScale(this.baseImgAspect);
    const [rx,ry] = this._coverScale(this.revealImgAspect);
    this.matDisplay.uniforms.uBaseScale.value.set(bx,by);
    this.matDisplay.uniforms.uRevealScale.value.set(rx,ry);
  }

  _buildMaterials(){
    const vert = `
      varying vec2 vUv;
      void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
    `;

    this.matSplat = new THREE.ShaderMaterial({
      vertexShader: vert,
      fragmentShader: `
        varying vec2 vUv;
        uniform sampler2D uTarget;
        uniform vec2 point;
        uniform vec3 color;
        uniform float radius;
        uniform float aspect;
        void main(){
          vec2 p = vUv - point;
          p.x *= aspect;
          float d = exp(-dot(p,p)/radius);
          vec3 base = texture2D(uTarget, vUv).xyz;
          gl_FragColor = vec4(base + d*color, 1.0);
        }
      `,
      uniforms:{ uTarget:{value:null}, point:{value:new THREE.Vector2()}, color:{value:new THREE.Vector3()}, radius:{value:0.02}, aspect:{value:1} }
    });

    this.matAdvection = new THREE.ShaderMaterial({
      vertexShader: vert,
      fragmentShader: `
        varying vec2 vUv;
        uniform sampler2D uVelocity;
        uniform sampler2D uSource;
        uniform vec2 texelSize;
        uniform float dt;
        uniform float dissipation;
        void main(){
          vec2 vel = texture2D(uVelocity, vUv).xy;
          vec2 coord = vUv - dt * vel * texelSize;
          vec4 result = texture2D(uSource, coord);
          gl_FragColor = dissipation * result;
        }
      `,
      uniforms:{ uVelocity:{value:null}, uSource:{value:null}, texelSize:{value:new THREE.Vector2()}, dt:{value:0.016}, dissipation:{value:0.985} }
    });

    this.matDivergence = new THREE.ShaderMaterial({
      vertexShader: vert,
      fragmentShader: `
        varying vec2 vUv;
        uniform sampler2D uVelocity;
        uniform vec2 texelSize;
        void main(){
          float L = texture2D(uVelocity, vUv - vec2(texelSize.x,0.0)).x;
          float R = texture2D(uVelocity, vUv + vec2(texelSize.x,0.0)).x;
          float B = texture2D(uVelocity, vUv - vec2(0.0,texelSize.y)).y;
          float T = texture2D(uVelocity, vUv + vec2(0.0,texelSize.y)).y;
          float div = 0.5*(R-L+T-B);
          gl_FragColor = vec4(div,0.0,0.0,1.0);
        }
      `,
      uniforms:{ uVelocity:{value:null}, texelSize:{value:new THREE.Vector2()} }
    });

    this.matCurl = new THREE.ShaderMaterial({
      vertexShader: vert,
      fragmentShader: `
        varying vec2 vUv;
        uniform sampler2D uVelocity;
        uniform vec2 texelSize;
        void main(){
          float L = texture2D(uVelocity, vUv - vec2(texelSize.x,0.0)).y;
          float R = texture2D(uVelocity, vUv + vec2(texelSize.x,0.0)).y;
          float B = texture2D(uVelocity, vUv - vec2(0.0,texelSize.y)).x;
          float T = texture2D(uVelocity, vUv + vec2(0.0,texelSize.y)).x;
          float c = R - L - T + B;
          gl_FragColor = vec4(0.5*c,0.0,0.0,1.0);
        }
      `,
      uniforms:{ uVelocity:{value:null}, texelSize:{value:new THREE.Vector2()} }
    });

    this.matVorticity = new THREE.ShaderMaterial({
      vertexShader: vert,
      fragmentShader: `
        varying vec2 vUv;
        uniform sampler2D uVelocity;
        uniform sampler2D uCurl;
        uniform vec2 texelSize;
        uniform float curlStrength;
        uniform float dt;
        void main(){
          float L = texture2D(uCurl, vUv - vec2(texelSize.x,0.0)).x;
          float R = texture2D(uCurl, vUv + vec2(texelSize.x,0.0)).x;
          float B = texture2D(uCurl, vUv - vec2(0.0,texelSize.y)).x;
          float T = texture2D(uCurl, vUv + vec2(0.0,texelSize.y)).x;
          float C = texture2D(uCurl, vUv).x;
          vec2 force = 0.5*vec2(abs(T)-abs(B), abs(R)-abs(L));
          force /= length(force) + 0.0001;
          force *= curlStrength * C;
          force.y *= -1.0;
          vec2 vel = texture2D(uVelocity, vUv).xy;
          vel += force * dt;
          vel = clamp(vel, -1000.0, 1000.0);
          gl_FragColor = vec4(vel, 0.0, 1.0);
        }
      `,
      uniforms:{ uVelocity:{value:null}, uCurl:{value:null}, texelSize:{value:new THREE.Vector2()}, curlStrength:{value:22}, dt:{value:0.016} }
    });

    this.matPressure = new THREE.ShaderMaterial({
      vertexShader: vert,
      fragmentShader: `
        varying vec2 vUv;
        uniform sampler2D uPressure;
        uniform sampler2D uDivergence;
        uniform vec2 texelSize;
        void main(){
          float L = texture2D(uPressure, vUv - vec2(texelSize.x,0.0)).x;
          float R = texture2D(uPressure, vUv + vec2(texelSize.x,0.0)).x;
          float B = texture2D(uPressure, vUv - vec2(0.0,texelSize.y)).x;
          float T = texture2D(uPressure, vUv + vec2(0.0,texelSize.y)).x;
          float div = texture2D(uDivergence, vUv).x;
          float p = (L+R+B+T-div)*0.25;
          gl_FragColor = vec4(p,0.0,0.0,1.0);
        }
      `,
      uniforms:{ uPressure:{value:null}, uDivergence:{value:null}, texelSize:{value:new THREE.Vector2()} }
    });

    this.matClear = new THREE.ShaderMaterial({
      vertexShader: vert,
      fragmentShader: `
        varying vec2 vUv;
        uniform sampler2D uTexture;
        uniform float value;
        void main(){ gl_FragColor = value * texture2D(uTexture, vUv); }
      `,
      uniforms:{ uTexture:{value:null}, value:{value:0.8} }
    });

    this.matGradientSubtract = new THREE.ShaderMaterial({
      vertexShader: vert,
      fragmentShader: `
        varying vec2 vUv;
        uniform sampler2D uPressure;
        uniform sampler2D uVelocity;
        uniform vec2 texelSize;
        void main(){
          float L = texture2D(uPressure, vUv - vec2(texelSize.x,0.0)).x;
          float R = texture2D(uPressure, vUv + vec2(texelSize.x,0.0)).x;
          float B = texture2D(uPressure, vUv - vec2(0.0,texelSize.y)).x;
          float T = texture2D(uPressure, vUv + vec2(0.0,texelSize.y)).x;
          vec2 vel = texture2D(uVelocity, vUv).xy;
          vel -= vec2(R-L, T-B);
          gl_FragColor = vec4(vel, 0.0, 1.0);
        }
      `,
      uniforms:{ uPressure:{value:null}, uVelocity:{value:null}, texelSize:{value:new THREE.Vector2()} }
    });

    // Final composite: dye density (from fluid sim) blends between the
    // two photographs. A small multi-tap blur is applied to the dye
    // sample here so the fluid reads as smooth flowing coverage rather
    // than scattered speckled fragments, regardless of the raw sim's
    // fine detail. Each texture is sampled with cover-style aspect
    // correction so photos never stretch regardless of canvas shape.
    this.matDisplay = new THREE.ShaderMaterial({
      vertexShader: vert,
      fragmentShader: `
        varying vec2 vUv;
        uniform sampler2D uDye;
        uniform sampler2D uBase;
        uniform sampler2D uReveal;
        uniform vec2 uBaseScale;
        uniform vec2 uRevealScale;
        uniform vec2 uDyeTexel;
        vec2 coverUv(vec2 uv, vec2 scale){
          return (uv - 0.5) * scale + 0.5;
        }
        float sampleDensity(vec2 uv){
          return length(texture2D(uDye, uv).rgb);
        }
        void main(){
          // 9-tap soft blur over the dye field to merge speckle into
          // smooth continuous coverage
          float d = 0.0;
          vec2 t = uDyeTexel;
          d += sampleDensity(vUv) * 0.28;
          d += sampleDensity(vUv + vec2( t.x,  0.0)) * 0.11;
          d += sampleDensity(vUv + vec2(-t.x,  0.0)) * 0.11;
          d += sampleDensity(vUv + vec2( 0.0,  t.y)) * 0.11;
          d += sampleDensity(vUv + vec2( 0.0, -t.y)) * 0.11;
          d += sampleDensity(vUv + vec2( t.x,  t.y)) * 0.07;
          d += sampleDensity(vUv + vec2(-t.x,  t.y)) * 0.07;
          d += sampleDensity(vUv + vec2( t.x, -t.y)) * 0.07;
          d += sampleDensity(vUv + vec2(-t.x, -t.y)) * 0.07;

          float density = smoothstep(0.04, 0.62, d * 2.2);
          vec2 baseUv = coverUv(vUv, uBaseScale);
          vec2 revealUv = coverUv(vUv, uRevealScale);
          vec4 baseCol = texture2D(uBase, baseUv);
          vec4 revealCol = texture2D(uReveal, revealUv);
          vec3 col = mix(baseCol.rgb, revealCol.rgb, density);
          gl_FragColor = vec4(col, 1.0);
        }
      `,
      uniforms:{ uDye:{value:null}, uBase:{value:null}, uReveal:{value:null}, uBaseScale:{value:new THREE.Vector2(1,1)}, uRevealScale:{value:new THREE.Vector2(1,1)}, uDyeTexel:{value:new THREE.Vector2(1/this.dyeRes,1/this.dyeRes)} }
    });
  }

  _renderPass(material, target){
    this.quad.material = material;
    this.renderer.setRenderTarget(target);
    this.renderer.render(this.scene, this.camera);
  }

  splat(x, y, dx, dy, aspect, strength = 1){
    const m = this.matSplat;
    m.uniforms.uTarget.value = this.velocity.read.texture;
    m.uniforms.point.value.set(x, y);
    m.uniforms.color.value.set(dx*this.splatForce*strength, dy*this.splatForce*strength, 0);
    m.uniforms.radius.value = (this.splatRadius / 100) * strength;
    m.uniforms.aspect.value = aspect;
    this._renderPass(m, this.velocity.write);
    this._swap(this.velocity);

    m.uniforms.uTarget.value = this.dye.read.texture;
    m.uniforms.color.value.set(2.2*strength, 1.8*strength, 2.0*strength); // violet-gold dye tint
    this._renderPass(m, this.dye.write);
    this._swap(this.dye);
  }

  resize(w, h){
    this.renderer.setSize(w, h, false);
    this._canvasAspect = w / h;
    this._updateCoverScales();
  }

  // Hard safety reset: fully clears velocity, pressure and dye back to
  // zero. Used periodically as a bulletproof guarantee against any
  // numerical drift/accumulation ever building into a full-canvas
  // overlay, regardless of cause — the sim simply cannot carry state
  // longer than the reset interval.
  clear(){
    this.matClear.uniforms.value.value = 0;
    [this.velocity, this.pressure, this.dye].forEach(pair=>{
      this.matClear.uniforms.uTexture.value = pair.read.texture;
      this._renderPass(this.matClear, pair.write);
      this._swap(pair);
      this.matClear.uniforms.uTexture.value = pair.read.texture;
      this._renderPass(this.matClear, pair.write);
      this._swap(pair);
    });
  }

  step(dt, aspect){
    const s = this.simRes;
    const texel = new THREE.Vector2(1/s, 1/s);

    // curl
    this.matCurl.uniforms.uVelocity.value = this.velocity.read.texture;
    this.matCurl.uniforms.texelSize.value = texel;
    this._renderPass(this.matCurl, this.curl);

    // vorticity confinement
    this.matVorticity.uniforms.uVelocity.value = this.velocity.read.texture;
    this.matVorticity.uniforms.uCurl.value = this.curl.texture;
    this.matVorticity.uniforms.texelSize.value = texel;
    this.matVorticity.uniforms.curlStrength.value = this.curlStrength;
    this.matVorticity.uniforms.dt.value = dt;
    this._renderPass(this.matVorticity, this.velocity.write);
    this._swap(this.velocity);

    // divergence
    this.matDivergence.uniforms.uVelocity.value = this.velocity.read.texture;
    this.matDivergence.uniforms.texelSize.value = texel;
    this._renderPass(this.matDivergence, this.divergence);

    // clear pressure (decay previous as initial guess)
    this.matClear.uniforms.uTexture.value = this.pressure.read.texture;
    this.matClear.uniforms.value.value = this.pressureDecay;
    this._renderPass(this.matClear, this.pressure.write);
    this._swap(this.pressure);

    // pressure jacobi iterations
    this.matPressure.uniforms.uDivergence.value = this.divergence.texture;
    this.matPressure.uniforms.texelSize.value = texel;
    for(let i=0;i<this.pressureIterations;i++){
      this.matPressure.uniforms.uPressure.value = this.pressure.read.texture;
      this._renderPass(this.matPressure, this.pressure.write);
      this._swap(this.pressure);
    }

    // gradient subtraction -> divergence-free velocity
    this.matGradientSubtract.uniforms.uPressure.value = this.pressure.read.texture;
    this.matGradientSubtract.uniforms.uVelocity.value = this.velocity.read.texture;
    this.matGradientSubtract.uniforms.texelSize.value = texel;
    this._renderPass(this.matGradientSubtract, this.velocity.write);
    this._swap(this.velocity);

    // advect velocity by itself
    this.matAdvection.uniforms.uVelocity.value = this.velocity.read.texture;
    this.matAdvection.uniforms.uSource.value = this.velocity.read.texture;
    this.matAdvection.uniforms.texelSize.value = texel;
    this.matAdvection.uniforms.dt.value = dt;
    this.matAdvection.uniforms.dissipation.value = this.velocityDissipation;
    this._renderPass(this.matAdvection, this.velocity.write);
    this._swap(this.velocity);

    // advect dye by velocity
    this.matAdvection.uniforms.uVelocity.value = this.velocity.read.texture;
    this.matAdvection.uniforms.uSource.value = this.dye.read.texture;
    this.matAdvection.uniforms.dissipation.value = this.dissipation;
    this._renderPass(this.matAdvection, this.dye.write);
    this._swap(this.dye);

    // composite to screen
    this.matDisplay.uniforms.uDye.value = this.dye.read.texture;
    this.matDisplay.uniforms.uBase.value = this.baseTex;
    this.matDisplay.uniforms.uReveal.value = this.revealTex;
    this.quad.material = this.matDisplay;
    this.renderer.setRenderTarget(null);
    this.renderer.clear();
    this.renderer.render(this.scene, this.camera);
  }

  swapTextures(baseUrl, revealUrl){
    const loader = new THREE.TextureLoader();
    const b = loader.load(baseUrl, tex=>{ this.baseImgAspect = tex.image.width/tex.image.height; this._updateCoverScales(); });
    const r = loader.load(revealUrl, tex=>{ this.revealImgAspect = tex.image.width/tex.image.height; this._updateCoverScales(); });
    [b,r].forEach(t=>{ t.minFilter=THREE.LinearFilter; t.magFilter=THREE.LinearFilter; t.colorSpace=THREE.SRGBColorSpace; });
    this.baseTex = b;
    this.revealTex = r;
  }
}