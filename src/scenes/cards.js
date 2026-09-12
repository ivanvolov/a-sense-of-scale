// Title and end cards.

import {
  W, H, MARGIN, PALETTE, clear, stars, vignette, hexA, mono, sans, roundRect,
} from '../lib/draw.js';
import { ramp, window_, easeOut, clamp } from '../lib/math.js';

export const intro = {
  id: 'intro',
  title: 'Заставка',
  duration: 4.2,
  draw(ctx, t) {
    clear(ctx, { glow: 0.25 });
    stars(ctx, { seed: 3, count: 420, alpha: easeOut(ramp(t, 0.2, 2.0)) });

    const a = window_(t, 0.3, 4.2, 0.7);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.textAlign = 'center';

    ctx.font = sans(22, 600);
    ctx.fillStyle = PALETTE.accent;
    ctx.letterSpacing = '0.34em';
    ctx.fillText('ЧУВСТВО МАСШТАБА', W / 2, H / 2 - 110);
    ctx.letterSpacing = '0px';

    ctx.font = sans(132, 700);
    ctx.fillStyle = PALETTE.ink;
    ctx.fillText('Три расстояния', W / 2, H / 2 + 10);

    ctx.font = sans(36, 400);
    ctx.fillStyle = PALETTE.dim;
    ctx.fillText('которые не помещаются в голову', W / 2, H / 2 + 80);

    const rule = easeOut(ramp(t, 1.0, 2.4));
    ctx.strokeStyle = hexA(PALETTE.accent, 0.6);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(W / 2 - 260 * rule, H / 2 + 140);
    ctx.lineTo(W / 2 + 260 * rule, H / 2 + 140);
    ctx.stroke();
    ctx.restore();

    vignette(ctx, 0.55);
  },
};

export const outro = {
  id: 'outro',
  title: 'Финал',
  duration: 6.0,
  draw(ctx, t) {
    clear(ctx, { glow: 0.2 });
    stars(ctx, { seed: 3, count: 420, alpha: 0.7 });

    const a = window_(t, 0.2, 6.0, 0.6);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.textAlign = 'center';
    ctx.font = sans(72, 700);
    ctx.fillStyle = PALETTE.ink;
    ctx.fillText('Ничего здесь не нарисовано «на глаз»', W / 2, 420);
    ctx.font = sans(34, 400);
    ctx.fillStyle = PALETTE.dim;
    ctx.fillText('Геометрия кадра и подписи к ней берутся из одних и тех же чисел.', W / 2, 480);
    ctx.restore();

    const rows = [
      ['Радиусы и расстояния', 'NASA/JPL Planetary Fact Sheets'],
      ['Астрономическая единица', 'IAU 2012, 149 597 870 700 м'],
      ['Скорость света', 'CODATA, 299 792 458 м/с — точно, по определению'],
      ['Орбита Луны', 'перигей 363 300 км · апогей 405 500 км'],
    ];

    const boxW = 1180, boxH = 300;
    const x = W / 2 - boxW / 2, y = 560;
    const ba = window_(t, 0.9, 6.0, 0.6);
    ctx.save();
    ctx.globalAlpha = ba;
    ctx.fillStyle = hexA('#0a1020', 0.9);
    roundRect(ctx, x, y, boxW, boxH, 16);
    ctx.fill();
    ctx.strokeStyle = hexA(PALETTE.line, 1);
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.textAlign = 'left';
    ctx.font = sans(20, 600);
    ctx.fillStyle = PALETTE.accent;
    ctx.letterSpacing = '0.24em';
    ctx.fillText('ИСТОЧНИКИ ЧИСЕЛ', x + 44, y + 48);
    ctx.letterSpacing = '0px';

    rows.forEach((r, i) => {
      const ry = y + 100 + i * 52;
      const ra = clamp(easeOut(ramp(t, 1.2 + i * 0.18, 1.9 + i * 0.18)));
      ctx.globalAlpha = ba * ra;
      ctx.font = sans(24, 600);
      ctx.fillStyle = PALETTE.ink;
      ctx.fillText(r[0], x + 44, ry);
      ctx.font = mono(22, 400);
      ctx.fillStyle = PALETTE.dim;
      ctx.fillText(r[1], x + 440, ry);
    });
    ctx.restore();

    vignette(ctx, 0.55);
  },
};
