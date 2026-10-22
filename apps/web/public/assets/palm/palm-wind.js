/*!
 * palm-wind.js: animasi pohon kelapa tertiup angin + kelapa jatuh (WebGL, latar transparan)
 *
 * Pakai:
 *   <canvas class="palm-wind" data-src="/assets/palm/"></canvas>
 *   <script src="/assets/palm/palm-wind.js" defer></script>
 *
 * data-src  : folder berisi palm-tree.webp, palm-front.webp, palm-mask.png, coconut.png
 * data-speed: kecepatan (default 1)
 * Ukuran tampil diatur dengan CSS (mis. width: 360px; height: auto).
 */
(function () {
  'use strict';

  var G = { W: 818, H: 1014, PADL: 50, w0: 638, TOP: 30, GROUND: 979.44, R: 20, T: 8.0,
            fallX: 413, fallY: 399, S: 46 };

  var VS = 'attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}';

  var FS = [
    'precision highp float;',
    'uniform sampler2D uTree,uFront,uMask,uCoco;',
    'uniform float uT;',
    'uniform vec4 uC;      // coconut x, y, angle(rad, clockwise), scale',
    'uniform float uCo;    // coconut opacity (0 = hidden)',
    'uniform vec3 uSh;     // shadow x, radius, opacity',
    'const float W=' + G.W.toFixed(1) + ',H=' + G.H.toFixed(1) + ',PADL=' + G.PADL.toFixed(1) +
      ',W0=' + G.w0.toFixed(1) + ',TOP=' + G.TOP.toFixed(1) + ',GR=' + G.GROUND.toFixed(2) +
      ',PER=' + G.T.toFixed(2) + ',S=' + G.S.toFixed(1) + ',R=' + G.R.toFixed(1) + ';',
    'vec4 over(vec4 top,vec4 bot){return top+bot*(1.-top.a);}',
    'void main(){',
    '  vec2 p=vec2(gl_FragCoord.x,H-gl_FragCoord.y);',
    '  float ph=6.2831853*uT/PER;',
    '  float hg=clamp((GR-p.y)/(GR-TOP),0.,1.);',
    '  float bend=pow(hg,2.3);',
    '  float lag=(p.x-PADL)/W0*.35;',
    '  float A=.55+.35*sin(ph-lag)+.18*sin(3.*ph+1.3-lag*2.)+.08*sin(7.*ph+.4-lag*3.);',
    '  float dx=A*bend*26.;',
    '  float dy=-abs(dx)*.08*hg;',
    '  float fl=texture2D(uMask,p/vec2(W,H)).r*hg;',
    '  dx+=fl*(3.2*sin(.06*p.y+.025*p.x-6.*ph)+1.6*sin(.11*p.y-.04*p.x-10.*ph+.7));',
    '  dy+=fl*(2.4*sin(.05*p.x-.02*p.y-8.*ph+1.1));',
    '  vec2 q=(p-vec2(dx,dy))/vec2(W,H);',
    '  vec4 col=vec4(0.);',
    // ground shadow of the falling coconut
    '  if(uSh.z>0.){',
    '    vec2 e=(p-vec2(uSh.x,GR-2.))/vec2(uSh.y,uSh.y*.25);',
    '    float s=(1.-smoothstep(.55,1.,length(e)))*uSh.z;',
    '    col=vec4(0.,0.,0.,s);',
    '  }',
    '  col=over(texture2D(uTree,q),col);',
    // falling coconut
    '  if(uCo>0.){',
    '    vec2 d=(p-uC.xy)/uC.w; float c=cos(uC.z),sn=sin(uC.z);',
    '    vec2 l=vec2(c*d.x+sn*d.y,-sn*d.x+c*d.y)+S*.5;',
    '    if(l.x>=0.&&l.y>=0.&&l.x<S&&l.y<S) col=over(texture2D(uCoco,l/S)*uCo,col);',
    '  }',
    '  col=over(texture2D(uFront,q),col);',
    '  gl_FragColor=col;',
    '}'
  ].join('\n');

  // ---- falling coconut timeline (mirrors the offline renderer) ----
  function fallState(t, maskAt) {
    var T = G.T, u = t / T, R = G.R, sx = G.fallX, sy = G.fallY, gy = G.GROUND - R * 1.05, k;
    function attached(ang, sc, op, lift) {
      var d = disp(sx, sy, t, maskAt);
      return { x: sx + d[0], y: sy + d[1] - (lift || 0), a: ang, s: sc, o: op, sh: 0 };
    }
    if (u < 0.30) return attached(0, 1, 1);
    if (u < 0.40) { k = (u - 0.30) / 0.10; return attached(-(14 * Math.sin(k * Math.PI * 5) * k) * Math.PI / 180, 1, 1); }
    var tt = t - 0.40 * T, fall = 0.95, x1 = sx + 30, out;
    if (tt < fall) { k = tt / fall; out = [sx + 30 * k * k, sy + (gy - sy) * k * k, 70 * k, 1]; }
    else if ((tt -= fall) < 0.42) { k = tt / 0.42; out = [x1 + 30 * k, gy - 280 * k * (1 - k), 70 + 180 * k, 1]; }
    else if ((tt -= 0.42) < 0.22) { k = tt / 0.22; out = [x1 + 30 + 16 * k, gy - 64 * k * (1 - k), 250 + 90 * k, 1]; }
    else if ((tt -= 0.22) < 0.9) { k = 1 - Math.pow(1 - tt / 0.9, 2); var dist = 46 * k; out = [x1 + 46 + dist, gy, 340 + dist / R * 57.3, 1]; }
    else {
      var xr = x1 + 92, ar = 340 + 46 / R * 57.3;
      if (u < 0.88) out = [xr, gy, ar, 1];
      else if (u < 0.93) out = [xr, gy, ar, 1 - (u - 0.88) / 0.05];
      else { k = (u - 0.93) / 0.07; return attached(0, Math.max(0.05, k), k, (1 - k) * R * 0.6); }
    }
    var h = Math.max(0, G.GROUND - R - out[1]), hn = Math.min(h, 300);
    return { x: out[0], y: out[1], a: out[2] * Math.PI / 180, s: 1, o: out[3],
             sh: 0.35 * (1 - hn / 400) * out[3], shr: R * (1.3 - hn / 600) };
  }

  function disp(x, y, t, maskAt) {
    var ph = 2 * Math.PI * t / G.T, hg = Math.min(1, Math.max(0, (G.GROUND - y) / (G.GROUND - G.TOP)));
    var lag = (x - G.PADL) / G.w0 * 0.35;
    var A = 0.55 + 0.35 * Math.sin(ph - lag) + 0.18 * Math.sin(3 * ph + 1.3 - lag * 2) + 0.08 * Math.sin(7 * ph + 0.4 - lag * 3);
    var dx = A * Math.pow(hg, 2.3) * 26, dy = -Math.abs(dx) * 0.08 * hg, fl = maskAt(x, y) * hg;
    dx += fl * (3.2 * Math.sin(0.06 * y + 0.025 * x - 6 * ph) + 1.6 * Math.sin(0.11 * y - 0.04 * x - 10 * ph + 0.7));
    dy += fl * (2.4 * Math.sin(0.05 * x - 0.02 * y - 8 * ph + 1.1));
    return [dx, dy];
  }

  function load(src) {
    return new Promise(function (res, rej) {
      var im = new Image(); im.crossOrigin = 'anonymous';
      im.onload = function () { res(im); }; im.onerror = rej; im.src = src;
    });
  }

  function mount(canvas) {
    var base = canvas.getAttribute('data-src') || '';
    var speed = parseFloat(canvas.getAttribute('data-speed') || '1');
    canvas.width = G.W; canvas.height = G.H;
    if (!canvas.getAttribute('role')) canvas.setAttribute('role', 'img');
    if (!canvas.getAttribute('aria-label')) canvas.setAttribute('aria-label', 'Pohon kelapa tertiup angin, sebuah kelapa jatuh');
    var gl = canvas.getContext('webgl', { premultipliedAlpha: true, alpha: true, antialias: false });
    if (!gl) { fallback(canvas, base); return; }

    Promise.all(['palm-tree.webp', 'palm-front.webp', 'palm-mask.png', 'coconut.png'].map(function (f) { return load(base + f); }))
      .then(function (ims) { start(gl, canvas, ims, speed); })
      .catch(function () { fallback(canvas, base); });
  }

  function start(gl, canvas, ims, speed) {
    function sh(type, src) {
      var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    }
    var pr = gl.createProgram();
    gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(pr); gl.useProgram(pr);
    var buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(pr, 'a'); gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    ['uTree', 'uFront', 'uMask', 'uCoco'].forEach(function (name, i) {
      var tx = gl.createTexture(); gl.activeTexture(gl.TEXTURE0 + i); gl.bindTexture(gl.TEXTURE_2D, tx);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, ims[i]);
      gl.uniform1i(gl.getUniformLocation(pr, name), i);
    });

    // CPU copy of the leaf mask so the falling coconut sways exactly like the crown
    var mc = document.createElement('canvas'); mc.width = ims[2].width; mc.height = ims[2].height;
    var mx = mc.getContext('2d'); mx.drawImage(ims[2], 0, 0);
    var md = mx.getImageData(0, 0, mc.width, mc.height).data;
    function maskAt(x, y) {
      var i = Math.min(mc.width - 1, Math.max(0, Math.round(x / 4))), j = Math.min(mc.height - 1, Math.max(0, Math.round(y / 4)));
      return md[(j * mc.width + i) * 4] / 255;
    }

    var uT = gl.getUniformLocation(pr, 'uT'), uC = gl.getUniformLocation(pr, 'uC'),
        uCo = gl.getUniformLocation(pr, 'uCo'), uSh = gl.getUniformLocation(pr, 'uSh');
    gl.viewport(0, 0, G.W, G.H);

    function draw(t) {
      var f = fallState(t, maskAt);
      gl.uniform1f(uT, t);
      gl.uniform4f(uC, f.x, f.y, f.a, f.s);
      gl.uniform1f(uCo, f.o);
      gl.uniform3f(uSh, f.x, f.shr || 1, f.sh);
      gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) { draw(0); return; }

    var visible = true, clock = 0, last = null, raf = 0;
    function loop(now) {
      if (last !== null) clock = (clock + Math.min(0.1, (now - last) / 1000) * speed) % G.T;
      last = now; draw(clock);
      raf = visible ? requestAnimationFrame(loop) : 0;
    }
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (es) {
        visible = es[0].isIntersecting;
        if (visible && !raf) { last = null; raf = requestAnimationFrame(loop); }
      }).observe(canvas);
    }
    canvas.__palmDraw = draw;     // debug / screenshot hook
    raf = requestAnimationFrame(loop);
  }

  function fallback(canvas, base) {
    var img = new Image(); img.src = base + 'palm-tree.webp'; img.alt = canvas.getAttribute('aria-label') || '';
    img.className = canvas.className; img.style.cssText = canvas.style.cssText;
    canvas.replaceWith(img);
  }

  function init() { document.querySelectorAll('canvas.palm-wind').forEach(mount); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  window.PalmWind = { mount: mount };
})();
