/**
 * Процедурный рендерер привидения-помощника Ostrovok на Canvas.
 * Поддерживает слежение глазами за курсором, моргание, левитацию и смену состояний.
 */

export type GhostState = "idle" | "thinking" | "speaking" | "happy" | "flying";

export class GhostCanvasRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private state: GhostState = "idle";
  private targetLook = { x: 0, y: 0 };
  private currentLook = { x: 0, y: 0 };
  private tilt = 0;
  private blinkPhase: "open" | "closing" | "closed" | "opening" = "open";
  private blinkAmount = 0;
  private nextBlinkTime = Date.now() + 3000;
  private closedPauseUntil = 0;
  private animationId: number | null = null;
  private width = 64;
  private height = 64;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D context is not available");
    this.ctx = ctx;
    this.setupDPI();
    this.startLoop();
  }

  private setupDPI(): void {
    const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 2 : 2;
    const rect = this.canvas.getBoundingClientRect();
    const w = rect.width || 64;
    const h = rect.height || 64;
    this.width = w;
    this.height = h;
    this.canvas.width = w * dpr;
    this.canvas.height = h * dpr;
    this.ctx.scale(dpr, dpr);
  }

  public setLookTarget(xRatio: number, yRatio: number): void {
    this.targetLook.x = Math.max(-1, Math.min(1, xRatio));
    this.targetLook.y = Math.max(-1, Math.min(1, yRatio));
  }

  public setState(newState: GhostState): void {
    this.state = newState;
  }

  public setTilt(radians: number): void {
    this.tilt = Math.max(-0.4, Math.min(0.4, radians));
  }

  private startLoop(): void {
    const render = () => {
      this.update();
      this.draw();
      this.animationId = requestAnimationFrame(render);
    };
    this.animationId = requestAnimationFrame(render);
  }

  public destroy(): void {
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  private update(): void {
    const now = Date.now();
    this.currentLook.x += (this.targetLook.x - this.currentLook.x) * 0.12;
    this.currentLook.y += (this.targetLook.y - this.currentLook.y) * 0.12;

    if (this.blinkPhase === "open" && now > this.nextBlinkTime) {
      this.blinkPhase = "closing";
    }

    if (this.blinkPhase === "closing") {
      this.blinkAmount += 0.04;
      if (this.blinkAmount >= 1.0) {
        this.blinkAmount = 1.0;
        this.blinkPhase = "closed";
        this.closedPauseUntil = now + 90;
      }
    } else if (this.blinkPhase === "closed" && now > this.closedPauseUntil) {
      this.blinkPhase = "opening";
    } else if (this.blinkPhase === "opening") {
      this.blinkAmount -= 0.05;
      if (this.blinkAmount <= 0) {
        this.blinkAmount = 0;
        this.blinkPhase = "open";
        this.nextBlinkTime = now + 3000 + Math.random() * 2500;
      }
    }
  }

  private draw(): void {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;
    const now = Date.now();

    ctx.clearRect(0, 0, w, h);

    const isFlying = this.state === "flying";
    const floatSpeed = isFlying ? 180 : 360;
    const floatAmp = isFlying ? 3.8 : 2.4;
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
    if (this.tilt !== 0) {
      ctx.translate(cx, cy);
      ctx.rotate(this.tilt);
      ctx.translate(-cx, -cy);
    }

    // Тело привидения
    ctx.beginPath();
    ctx.arc(cx, topY + r, r, Math.PI, 0, false);
    ctx.lineTo(rightX, bottomY - 5);

    // Волнистая юбочка снизу
    const waveW = bodyW / 3;
    const waveFreq = isFlying ? 140 : 220;
    const waveH = 4.0 + Math.sin(now / waveFreq) * 1.6;
    ctx.quadraticCurveTo(rightX - waveW * 0.5, bottomY + waveH, rightX - waveW, bottomY - 3);
    ctx.quadraticCurveTo(cx, bottomY + waveH, cx - waveW * 0.5, bottomY - 3);
    ctx.quadraticCurveTo(leftX + waveW * 0.5, bottomY + waveH, leftX, bottomY - 5);

    ctx.lineTo(leftX, topY + r);
    ctx.closePath();

    ctx.fillStyle = "#FFFFFF";
    ctx.fill();

    // Фирменный контур Ostrovok
    ctx.lineWidth = 3.2;
    ctx.strokeStyle = "#1652F0";
    ctx.lineJoin = "round";
    ctx.stroke();

    // Розовый румянец
    ctx.fillStyle = "rgba(255, 140, 160, 0.45)";
    const blushR = bodyW * 0.12;
    const blushY = topY + r + 12;
    ctx.beginPath();
    ctx.ellipse(cx - bodyW * 0.28, blushY, blushR, blushR * 0.6, 0, 0, Math.PI * 2);
    ctx.ellipse(cx + bodyW * 0.28, blushY, blushR, blushR * 0.6, 0, 0, Math.PI * 2);
    ctx.fill();

    // Глазки
    this.drawEyes(ctx, cx, topY + r + 3, bodyW);
    ctx.restore();
  }

  private drawEyes(
    ctx: CanvasRenderingContext2D,
    cx: number,
    eyeCenterY: number,
    bodyW: number
  ): void {
    const eyeSpacing = bodyW * 0.24;
    const leftEyeX = cx - eyeSpacing;
    const rightEyeX = cx + eyeSpacing;
    const maxEyeR = 3.6;

    const pupilOffsetX = this.currentLook.x * 2.0;
    const pupilOffsetY = this.currentLook.y * 1.6;

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

    const currentHeightR = Math.max(0.4, maxEyeR * (1 - this.blinkAmount));
    [leftEyeX, rightEyeX].forEach((eyeX) => {
      ctx.save();
      ctx.beginPath();
      ctx.fillStyle = "#111827";
      ctx.ellipse(eyeX + pupilOffsetX, eyeCenterY + pupilOffsetY, maxEyeR, currentHeightR, 0, 0, Math.PI * 2);
      ctx.fill();

      if (this.blinkAmount < 0.45) {
        ctx.beginPath();
        ctx.fillStyle = "#FFFFFF";
        ctx.arc(eyeX + pupilOffsetX - 1.1, eyeCenterY + pupilOffsetY - 0.9, 1.1, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    });
  }
}
