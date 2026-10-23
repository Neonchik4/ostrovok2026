/**
 * Procedural Canvas Mascot: Friendly Ghost-Traveler
 * Completely transparent background, lifelike eyelid physics, smooth blinking & flight tilt.
 */
export class GhostCanvas {
  constructor(canvasElement) {
    this.canvas = canvasElement;
    this.ctx = canvasElement.getContext("2d");
    this.state = "idle"; // idle | thinking | speaking | happy | flying
    this.targetLook = { x: 0, y: 0 };
    this.currentLook = { x: 0, y: 0 };
    this.tilt = 0; // flight tilt in radians

    // Lifelike smooth blink cycle (slower, natural opening/closing)
    this.blinkPhase = "open"; // open | closing | closed | opening
    this.blinkAmount = 0;     // 0.0 (fully open) to 1.0 (fully closed)
    this.nextBlinkTime = Date.now() + 3200;
    this.closedPauseUntil = 0;
    this.animationId = null;

    this.setupDPI();
    this.startLoop();
  }

  setupDPI() {
    const dpr = window.devicePixelRatio || 2;
    const rect = this.canvas.getBoundingClientRect();
    const w = rect.width || 64;
    const h = rect.height || 64;
    this.width = w;
    this.height = h;
    this.canvas.width = w * dpr;
    this.canvas.height = h * dpr;
    this.ctx.scale(dpr, dpr);
  }

  setLookTarget(xRatio, yRatio) {
    this.targetLook.x = Math.max(-1, Math.min(1, xRatio));
    this.targetLook.y = Math.max(-1, Math.min(1, yRatio));
  }

  setTilt(radians) {
    this.tilt = Math.max(-0.4, Math.min(0.4, radians));
  }

  setState(newState) {
    this.state = newState;
  }

  startLoop() {
    const render = () => {
      this.update();
      this.draw();
      this.animationId = requestAnimationFrame(render);
    };
    this.animationId = requestAnimationFrame(render);
  }

  destroy() {
    if (this.animationId) cancelAnimationFrame(this.animationId);
  }

  update() {
    const now = Date.now();

    // Smooth pupil tracking
    this.currentLook.x += (this.targetLook.x - this.currentLook.x) * 0.12;
    this.currentLook.y += (this.targetLook.y - this.currentLook.y) * 0.12;

    // Smooth, slow eyelid closure (no sudden flash/glitch)
    if (this.blinkPhase === "open" && now > this.nextBlinkTime) {
      this.blinkPhase = "closing";
    }

    if (this.blinkPhase === "closing") {
      this.blinkAmount += 0.035; // gentle, relaxed closing (~28 frames)
      if (this.blinkAmount >= 1.0) {
        this.blinkAmount = 1.0;
        this.blinkPhase = "closed";
        this.closedPauseUntil = now + 85; // natural closed rest duration
      }
    } else if (this.blinkPhase === "closed" && now > this.closedPauseUntil) {
      this.blinkPhase = "opening";
    } else if (this.blinkPhase === "opening") {
      this.blinkAmount -= 0.04; // gentle opening
      if (this.blinkAmount <= 0) {
        this.blinkAmount = 0;
        this.blinkPhase = "open";
        this.nextBlinkTime = now + 3500 + Math.random() * 2500;
      }
    }
  }

  draw() {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;
    const now = Date.now();

    ctx.clearRect(0, 0, w, h);

    // Subtle levitation sine-wave offset (faster skirt fluttering when flying)
    const isFlying = this.state === "flying";
    const floatSpeed = isFlying ? 180 : 360;
    const floatAmp = isFlying ? 4.0 : 2.6;
    const floatOffset = Math.sin(now / floatSpeed) * floatAmp;

    const cx = w / 2;
    const cy = h / 2 + floatOffset;

    const bodyW = w * 0.74;
    const bodyH = h * 0.78;
    const r = bodyW / 2;
    const topY = cy - bodyH / 2;
    const bottomY = cy + bodyH / 2;
    const leftX = cx - r;
    const rightX = cx + r;

    ctx.save();
    // Apply flight tilt around center
    if (this.tilt !== 0) {
      ctx.translate(cx, cy);
      ctx.rotate(this.tilt);
      ctx.translate(-cx, -cy);
    }

    // Ghost body path
    ctx.beginPath();
    // Top dome
    ctx.arc(cx, topY + r, r, Math.PI, 0, false);
    // Right side
    ctx.lineTo(rightX, bottomY - 6);

    // Bottom 3 scallops (wavy skirt with gentle wave animation)
    const waveW = bodyW / 3;
    const waveFreq = isFlying ? 140 : 220;
    const waveH = 4.5 + Math.sin(now / waveFreq) * 1.8;
    ctx.quadraticCurveTo(rightX - waveW * 0.5, bottomY + waveH, rightX - waveW, bottomY - 4);
    ctx.quadraticCurveTo(cx, bottomY + waveH, cx - waveW * 0.5, bottomY - 4);
    ctx.quadraticCurveTo(leftX + waveW * 0.5, bottomY + waveH, leftX, bottomY - 6);

    // Left side
    ctx.lineTo(leftX, topY + r);
    ctx.closePath();

    // Body fill (clean solid white, completely transparent outside)
    ctx.fillStyle = "#FFFFFF";
    ctx.fill();

    // Outline (Ostrovok Brand Blue #1652F0)
    ctx.lineWidth = 3.6;
    ctx.strokeStyle = "#1652F0";
    ctx.lineJoin = "round";
    ctx.stroke();

    // Cute pink blush under eyes
    ctx.fillStyle = "rgba(255, 140, 160, 0.45)";
    const blushR = bodyW * 0.12;
    const blushY = topY + r + 13;
    ctx.beginPath();
    ctx.ellipse(cx - bodyW * 0.28, blushY, blushR, blushR * 0.6, 0, 0, Math.PI * 2);
    ctx.ellipse(cx + bodyW * 0.28, blushY, blushR, blushR * 0.6, 0, 0, Math.PI * 2);
    ctx.fill();

    // Eyes
    this.drawEyes(ctx, cx, topY + r + 4, bodyW);
    ctx.restore();
  }

  drawEyes(ctx, cx, eyeCenterY, bodyW) {
    const eyeSpacing = bodyW * 0.24;
    const leftEyeX = cx - eyeSpacing;
    const rightEyeX = cx + eyeSpacing;
    const maxEyeR = 3.8;

    const pupilOffsetX = this.currentLook.x * 2.2;
    const pupilOffsetY = this.currentLook.y * 1.8;

    // Happy state (winking playful arcs)
    if (this.state === "happy") {
      ctx.lineWidth = 2.4;
      ctx.strokeStyle = "#111827";
      ctx.lineCap = "round";

      ctx.beginPath();
      ctx.arc(leftEyeX, eyeCenterY, maxEyeR, Math.PI * 1.1, Math.PI * 1.9, false);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(rightEyeX, eyeCenterY, maxEyeR, Math.PI * 1.1, Math.PI * 1.9, false);
      ctx.stroke();
      return;
    }

    // Smooth eyelid closure based on blinkAmount (0 = full circle, 1 = closed line)
    const currentHeightR = Math.max(0.4, maxEyeR * (1 - this.blinkAmount));

    [leftEyeX, rightEyeX].forEach((eyeX) => {
      ctx.save();
      ctx.beginPath();
      ctx.fillStyle = "#111827";
      ctx.ellipse(eyeX + pupilOffsetX, eyeCenterY + pupilOffsetY, maxEyeR, currentHeightR, 0, 0, Math.PI * 2);
      ctx.fill();

      // Catchlight only visible when eye is sufficiently open
      if (this.blinkAmount < 0.45) {
        ctx.beginPath();
        ctx.fillStyle = "#FFFFFF";
        ctx.arc(eyeX + pupilOffsetX - 1.2, eyeCenterY + pupilOffsetY - 1.0, 1.2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    });
  }
}
