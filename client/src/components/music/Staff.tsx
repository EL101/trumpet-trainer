import { Box, type BoxProps } from "@chakra-ui/react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Accidental,
  Barline,
  Beam,
  Dot,
  Formatter,
  Renderer,
  Stave,
  StaveNote,
  Voice,
  type RenderContext,
} from "vexflow";
import { centsColor, formatCents } from "@/lib/intonation";
import { roles } from "@/theme";
import { getKeySig } from "@/utils/generateMusic";
import type { Key } from "@/schema";
import { parseMeasures, resolveMeasuresPerLine } from "./staffNotation";

export type StaffProps = Omit<BoxProps, "children" | "width" | "color"> & {
  /** App note format, e.g. "G4/8, A4, B4/q, C5/h". */
  notes: string;
  timeSig: string;
  /** Omit for no key signature (e.g. an intonation chart in written pitch). */
  musicKey?: Key;
  /** Pixel width. Omit to fill the container. */
  width?: number;
  /** Notation scale; 1 ≈ the mockups' full-size staff, 0.5 for incipits. */
  scale?: number;
  /** Bars per system. Defaults to all bars on one line. */
  measuresPerLine?: number;
  /** Cents deviation per note (rests included in the count); colours each note. */
  cents?: readonly (number | null)[];
  /** Fractional note index for the playback cursor. */
  cursor?: number;
  /** Print each note's cents value beneath it. */
  annotate?: boolean;
  /** Custom text beneath each note (overrides `annotate`'s cents). */
  labels?: readonly string[];
  /** Single CSS colour for every note (e.g. `roles.accent.solid`). */
  noteColor?: string;
  /** Set to false for charts (scales, intonation by note): no barlines and no time signature. */
  barlines?: boolean;
};

const LINE_HEIGHT = 100;
const ANNOTATED_LINE_HEIGHT = 124;
const SVG_NS = "http://www.w3.org/2000/svg";

/** Treble staff rendered with VexFlow, with optional per-note intonation colouring and cursor. */
export function Staff({
  notes,
  timeSig,
  musicKey,
  width,
  scale = 1,
  measuresPerLine,
  cents,
  cursor,
  annotate,
  labels,
  noteColor,
  barlines = true,
  ...rest
}: StaffProps) {
  const ref = useRef<HTMLDivElement>(null);
  const measuredWidth = useElementWidth(ref, width == null);
  const W = width ?? measuredWidth;

  const measures = useMemo(() => parseMeasures(notes, timeSig), [notes, timeSig]);
  const perLine = resolveMeasuresPerLine(measuresPerLine, measures.length);
  const lineCount = Math.max(1, Math.ceil(measures.length / perLine));
  const showText = !!labels || !!annotate;
  const lineHeight = showText ? ANNOTATED_LINE_HEIGHT : LINE_HEIGHT;
  const height = Math.ceil(lineCount * lineHeight * scale);

  useEffect(() => {
    const host = ref.current;
    if (!host || !W) return;
    host.innerHTML = "";

    const renderer = new Renderer(host, Renderer.Backends.SVG);
    renderer.resize(W, height);
    const ctx = renderer.getContext();
    ctx.scale(scale, scale);
    ctx.setFillStyle(roles.fg.DEFAULT);
    ctx.setStrokeStyle(roles.fg.DEFAULT);

    const placed = drawMeasures(ctx, {
      measures,
      perLine,
      lineHeight,
      innerWidth: W / scale,
      keySig: musicKey ? getKeySig(musicKey) : "",
      timeSig,
      barlines,
      colorFor: (i, isRest) => {
        if (isRest) return roles.fg.DEFAULT;
        if (noteColor) return noteColor;
        const c = cents?.[i];
        return c != null && !Number.isNaN(c) ? centsColor(c) : roles.fg.DEFAULT;
      },
    });

    const svg = host.querySelector("svg");
    if (!svg) return;
    svg.style.display = "block";
    svg.style.overflow = "visible";
    if (cursor != null) drawCursor(svg, placed, cursor);
    if (showText) {
      drawLabels(svg, placed, (i) =>
        labels ? (labels[i] ?? "") : cents?.[i] != null ? formatCents(cents[i]!, false) : "",
      );
    }
    return () => {
      host.innerHTML = "";
    };
  }, [
    measures,
    perLine,
    lineHeight,
    W,
    height,
    scale,
    musicKey,
    timeSig,
    barlines,
    cents,
    cursor,
    labels,
    noteColor,
    showText,
  ]);

  return (
    <Box ref={ref} width={width != null ? `${width}px` : "100%"} height={`${height}px`} {...rest} />
  );
}

/** Tracks an element's content width (only when `enabled`). */
function useElementWidth(ref: React.RefObject<HTMLElement | null>, enabled: boolean) {
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled) return;
    const ro = new ResizeObserver(([entry]) => setW(Math.floor(entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref, enabled]);
  return w;
}

type Placed = { note: StaveNote; stave: Stave; color: string; rest: boolean };

function drawMeasures(
  ctx: RenderContext,
  opts: {
    measures: ReturnType<typeof parseMeasures>;
    perLine: number;
    lineHeight: number;
    innerWidth: number;
    keySig: string;
    timeSig: string;
    barlines: boolean;
    colorFor: (index: number, isRest: boolean) => string;
  },
): Placed[] {
  const { measures, perLine, lineHeight, innerWidth, keySig, timeSig, barlines, colorFor } = opts;
  const [beats, beatValue] = timeSig.split("/").map(Number);
  // Beam by the meter's beat (e.g. 3+3 in 6/8); VexFlow otherwise pairs eighths in every meter.
  const beamGroups = Beam.getDefaultBeamGroups(timeSig);
  const staveOpts = { space_above_staff_ln: 3, space_below_staff_ln: 3 };
  const placed: Placed[] = [];
  let index = 0;

  for (let start = 0, line = 0; start < measures.length; start += perLine, line++) {
    const bars = measures.slice(start, start + perLine);
    const y = line * lineHeight;
    const isLastLine = start + perLine >= measures.length;

    // Measure how much room the clef / key / time take so bars get equal note space.
    const probe = new Stave(0, y, 300, staveOpts).addClef("treble");
    if (keySig) probe.addKeySignature(keySig);
    if (line === 0 && barlines) probe.addTimeSignature(timeSig);
    const preamble = probe.getNoteStartX() - probe.getX();
    const barWidth = (innerWidth - 2 - preamble) / bars.length;

    let x = 1;
    bars.forEach((bar, bi) => {
      const w = bi === 0 ? preamble + barWidth : barWidth;
      const stave = new Stave(x, y, w, staveOpts);
      x += w;
      if (bi === 0) {
        stave.addClef("treble");
        if (keySig) stave.addKeySignature(keySig);
        if (line === 0 && barlines) stave.addTimeSignature(timeSig);
      }
      if (!barlines) {
        stave.setEndBarType(Barline.type.NONE);
        if (bi > 0) stave.setBegBarType(Barline.type.NONE);
      } else if (isLastLine && bi === bars.length - 1) {
        stave.setEndBarType(Barline.type.END);
      }
      stave.setContext(ctx).draw();

      const staveNotes = bar.map((p) => {
        const n = new StaveNote({
          keys: [p.key],
          duration: p.duration + (p.dotted ? "d" : "") + (p.rest ? "r" : ""),
          auto_stem: true,
        });
        if (p.dotted) Dot.buildAndAttach([n], { all: true });
        return n;
      });

      const voice = new Voice({ num_beats: beats || 4, beat_value: beatValue || 4 }).setMode(
        Voice.Mode.SOFT,
      );
      voice.addTickables(staveNotes);
      Accidental.applyAccidentals([voice], keySig || "C");
      const beams = barlines ? Beam.generateBeams(staveNotes, { groups: beamGroups }) : [];
      new Formatter()
        .joinVoices([voice])
        .format([voice], Math.max(10, stave.getNoteEndX() - stave.getNoteStartX() - 14));

      staveNotes.forEach((n, k) => {
        const color = colorFor(index++, bar[k].rest);
        const style = { fillStyle: color, strokeStyle: color };
        n.setStyle(style);
        n.setStemStyle(style);
        n.setFlagStyle(style);
        n.setLedgerLineStyle(style);
        n.getModifiers().forEach((m) => m.setStyle(style));
        placed.push({ note: n, stave, color, rest: bar[k].rest });
      });

      voice.draw(ctx, stave);
      beams.forEach((b) => {
        const first = placed.find((p) => p.note === b.getNotes()[0]);
        if (first) b.setStyle({ fillStyle: first.color, strokeStyle: first.color });
        b.setContext(ctx).draw();
      });
    });
  }
  return placed;
}

function svgEl(
  tag: string,
  attrs: Record<string, string | number>,
  style: Record<string, string> = {},
) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  // Colours go through `style` so color-mix() values resolve like any CSS colour.
  for (const [k, v] of Object.entries(style)) el.style.setProperty(k, v);
  return el;
}

function noteCenterX(n: StaveNote) {
  return (n.getNoteHeadBeginX() + n.getNoteHeadEndX()) / 2;
}

function drawCursor(svg: SVGSVGElement, placed: Placed[], cursor: number) {
  if (!placed.length) return;
  const i0 = Math.max(0, Math.min(placed.length - 1, Math.floor(cursor)));
  const q0 = placed[i0];
  const q1 = placed[i0 + 1];
  let x = noteCenterX(q0.note);
  if (q1 && q1.stave.getY() === q0.stave.getY()) x += (noteCenterX(q1.note) - x) * (cursor - i0);
  const top = q0.stave.getYForLine(0) - 20;
  const bottom = q0.stave.getYForLine(4) + 20;

  const band = svgEl(
    "rect",
    { x: x - 14, y: top, width: 28, height: bottom - top, rx: 3 },
    { fill: roles.accent.cursor },
  );
  const rule = svgEl(
    "line",
    { x1: x, x2: x, y1: top, y2: bottom, "stroke-width": 1.25 },
    { stroke: roles.accent.solid },
  );
  svg.insertBefore(rule, svg.firstChild);
  svg.insertBefore(band, svg.firstChild);
}

function drawLabels(svg: SVGSVGElement, placed: Placed[], textFor: (i: number) => string) {
  placed.forEach((p, i) => {
    if (p.rest) return;
    const text = textFor(i);
    if (!text) return;
    const y = Math.max(p.stave.getYForLine(4) + 38, Math.max(...p.note.getYs()) + 24);
    const color = p.color === roles.fg.DEFAULT ? roles.fg.muted : p.color;
    const t = svgEl(
      "text",
      { x: noteCenterX(p.note), y, "text-anchor": "middle", "font-size": 10 },
      {
        fill: color,
        "font-family": "var(--chakra-fonts-body)",
        "font-variant-numeric": "tabular-nums",
      },
    );
    t.textContent = text;
    svg.appendChild(t);
  });
}
