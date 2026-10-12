import { Box, type BoxProps } from "@chakra-ui/react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Accidental,
  Barline,
  Beam,
  Curve,
  Dot,
  Flow,
  Formatter,
  Renderer,
  Stave,
  StaveNote,
  StaveTie,
  Stem,
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
  // Notes far above or below the staff can reach past the lines' allotted height; the
  // drawing grows to fit them so they don't spill over neighbouring content.
  const [drawnHeight, setDrawnHeight] = useState(height);

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
      showText,
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
    setDrawnHeight(fitToContent(svg, W, height, scale));
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
    <Box
      ref={ref}
      width={width != null ? `${width}px` : "100%"}
      height={`${Math.max(height, drawnHeight)}px`}
      {...rest}
    />
  );
}

/**
 * Grows the SVG to take in anything drawn above or below its `height`, keeping the
 * staff where it was, and returns the new pixel height.
 */
function fitToContent(svg: SVGSVGElement, width: number, height: number, scale: number) {
  if (typeof svg.getBBox !== "function") return height; // jsdom
  const box = svg.getBBox();
  const pad = 2;
  const top = Math.min(0, box.y - pad);
  const bottom = Math.max(height / scale, box.y + box.height + pad);
  const fitted = Math.ceil((bottom - top) * scale);
  if (fitted <= height) return height;
  svg.setAttribute("viewBox", `0 ${top} ${width / scale} ${fitted / scale}`);
  svg.setAttribute("height", String(fitted));
  svg.style.height = `${fitted}px`;
  return fitted;
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

type Placed = {
  note: StaveNote;
  stave: Stave;
  color: string;
  rest: boolean;
  tied: boolean;
  slurStart: boolean;
  slurEnd: boolean;
};

/** One bar, built and formatted but not yet drawn. */
type Bar = { stave: Stave; voice: Voice; beams: Beam[] };

// Vertical layout in staff units (10 = one staff space), relative to a stave's y.
const STAFF_TOP = 30; // the top line, below `space_above_staff_ln` of headroom
const STAFF_BOTTOM = 70;
/** Clearance between the lowest mark of one line and the highest of the next. */
const LINE_GAP = 12;
/** Room the per-note text takes below the lowest note or the staff (see `drawLabels`). */
const LABEL_ROOM = 42;
/** Room a slur's arc takes above a line's highest note (see `drawSlurs`). */
const SLUR_ROOM = 24;

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
    showText: boolean;
    colorFor: (index: number, isRest: boolean) => string;
  },
): Placed[] {
  const { measures, perLine, lineHeight, innerWidth, keySig, timeSig, barlines, colorFor } = opts;
  const [beats, beatValue] = timeSig.split("/").map(Number);
  // Beam by the meter's beat (e.g. 3+3 in 6/8); VexFlow otherwise pairs eighths in every meter.
  const beamGroups = Beam.getDefaultBeamGroups(timeSig);
  const staveOpts = { space_above_staff_ln: 3, space_below_staff_ln: 3 };
  const placed: Placed[] = [];
  const lines: Bar[][] = [];
  const slurredLines = new Set<number>();
  let index = 0;

  // Build every line first (at y = 0) so each one's reach above and below the staff is
  // known before the lines are spaced out.
  for (let start = 0, line = 0; start < measures.length; start += perLine, line++) {
    const bars = measures.slice(start, start + perLine);
    const isLastLine = start + perLine >= measures.length;
    if (bars.flat().some((p) => p.slurStart || p.slurEnd)) slurredLines.add(line);

    // Measure how much room the clef / key / time take so bars get equal note space.
    const probe = new Stave(0, 0, 300, staveOpts).addClef("treble");
    if (keySig) probe.addKeySignature(keySig);
    if (line === 0 && barlines) probe.addTimeSignature(timeSig);
    const preamble = probe.getNoteStartX() - probe.getX();
    const barWidth = (innerWidth - 2 - preamble) / bars.length;

    let x = 1;
    lines.push(
      bars.map((bar, bi) => {
        const w = bi === 0 ? preamble + barWidth : barWidth;
        const stave = new Stave(x, 0, w, staveOpts);
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
        const beams = barlines ? beamByGroup(staveNotes, beamGroups) : [];
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
          const { rest, tied, slurStart, slurEnd } = bar[k];
          placed.push({ note: n, stave, color, rest, tied, slurStart, slurEnd });
        });
        return { stave, voice, beams };
      }),
    );
  }

  // Lines sit `lineHeight` apart, or further when one's low notes would meet the next's
  // high ones.
  let y = 0;
  let prevBottom = 0;
  lines.forEach((bars, line) => {
    const { top, bottom } = lineExtent(bars, opts.showText, slurredLines.has(line));
    if (line > 0) y = Math.max(y + lineHeight, y + prevBottom - top + LINE_GAP);
    prevBottom = bottom;

    bars.forEach(({ stave, voice, beams }) => {
      stave.setY(y).setContext(ctx).draw();
      voice.draw(ctx, stave);
      beams.forEach((b) => {
        const first = placed.find((p) => p.note === b.getNotes()[0]);
        if (first) b.setStyle({ fillStyle: first.color, strokeStyle: first.color });
        b.setContext(ctx).draw();
      });
    });
  });
  drawTies(ctx, placed);
  drawSlurs(ctx, placed);
  return placed;
}

/**
 * Beams each run of eighths or shorter that falls within one beat group, breaking at
 * rests and at notes that cross into the next group. (VexFlow's `Beam.generateBeams`
 * loses its place after a note that crosses a group boundary and leaves the rest of
 * the bar unbeamed.)
 */
function beamByGroup(notes: StaveNote[], groups: ReturnType<typeof Beam.getDefaultBeamGroups>) {
  const sizes = groups.map((g) => g.clone().multiply(Flow.RESOLUTION, 1).value());
  const beams: Beam[] = [];
  let run: StaveNote[] = [];
  const flush = () => {
    if (run.length > 1) beams.push(new Beam(run, true));
    run = [];
  };
  let pos = 0;
  let group = 0;
  let groupEnd = sizes[0];
  for (const n of notes) {
    while (pos >= groupEnd) {
      flush();
      group = (group + 1) % sizes.length;
      groupEnd += sizes[group];
    }
    const end = pos + n.getTicks().value();
    const beamable = !n.isRest() && n.getIntrinsicTicks() < Flow.durationToTicks("4");
    if (beamable && end <= groupEnd) run.push(n);
    else flush();
    pos = end;
  }
  flush();
  return beams;
}

/**
 * How far a line's notes reach above and below the staff, relative to its stave's y:
 * note heads plus stems (a beam can stretch a stem a little past its usual length), and
 * the arc over them if the line has slurs.
 */
function lineExtent(bars: Bar[], showText: boolean, slurred: boolean) {
  let top = STAFF_TOP;
  let bottom = STAFF_BOTTOM;
  let lowest = STAFF_BOTTOM;
  const stem = Stem.HEIGHT + 6;
  for (const { voice } of bars) {
    for (const n of voice.getTickables() as StaveNote[]) {
      if (n.isRest()) continue;
      // Key line 5 is the staff's top line, 1 its bottom one (as `Stave.getYForNote`).
      const head = STAFF_TOP + 50 - n.getKeyProps()[0].line * 10;
      const up = n.getStemDirection() === Stem.UP;
      top = Math.min(top, head - 6 - (up ? stem : 0));
      bottom = Math.max(bottom, head + 6 + (up ? 0 : stem));
      lowest = Math.max(lowest, head);
    }
  }
  if (showText) bottom = Math.max(bottom, lowest + LABEL_ROOM);
  if (slurred) top -= SLUR_ROOM;
  return { top, bottom };
}

/**
 * Ties each tied note to the one after it, in the first note's colour. A tie across a
 * line break is drawn in two halves: off the end of one line, and into the next.
 */
function drawTies(ctx: RenderContext, placed: Placed[]) {
  placed.forEach((p, i) => {
    const next = placed[i + 1];
    if (!p.tied || !next) return;
    const halves =
      next.stave.getY() === p.stave.getY()
        ? [{ first_note: p.note, last_note: next.note }]
        : [
            { first_note: p.note, last_note: null },
            { first_note: null, last_note: next.note },
          ];
    halves.forEach(({ first_note, last_note }) => {
      const tie = new StaveTie({ first_note, last_note, first_indices: [0], last_indices: [0] });
      // VexFlow bends every tie by the same amount, which leaves a long one nearly flat;
      // bend it more the further it reaches, up to a limit.
      const from = first_note?.getTieRightX() ?? next.stave.getTieStartX();
      const to = last_note?.getTieLeftX() ?? p.stave.getTieEndX();
      const bend = Math.min(22, 8 + Math.abs(to - from) * 0.03);
      tie.render_options.cp1 = bend;
      tie.render_options.cp2 = bend + 4;
      tie.setStyle({ fillStyle: p.color, strokeStyle: p.color }).setContext(ctx).draw();
    });
  });
}

/**
 * Draws each slur, from a note that starts one to the next that ends one, in the first
 * note's colour. It arcs over the notes, or under their heads if every stem points up. A
 * slur across a line break is drawn in parts: off the end of one line, into the next.
 */
function drawSlurs(ctx: RenderContext, placed: Placed[]) {
  let start = -1;
  placed.forEach((p, i) => {
    if (p.slurStart) start = i;
    if (!p.slurEnd || start < 0) return;
    const slurred = placed.slice(start, i + 1);
    start = -1;
    const above = slurred.some(({ note }) => note.getStemDirection() !== Stem.UP);
    // Notes heard under the slur, split into one run per line of music.
    const lines: Placed[][] = [];
    for (const q of slurred) {
      const line = lines[lines.length - 1];
      if (line && line[0].stave.getY() === q.stave.getY()) line.push(q);
      else lines.push([q]);
    }
    lines.forEach((line, l) => {
      const from = l === 0 ? line[0].note : null;
      const to = l === lines.length - 1 ? line[line.length - 1].note : null;
      // A part that starts or ends at a line break takes its height from its other end.
      const first = from ?? to!;
      const last = to ?? from!;
      // Over a stem pointing up, a slur above starts from the stem's tip, not the head.
      const end = (note: StaveNote) =>
        above && note.getStemDirection() === Stem.UP
          ? Curve.Position.NEAR_TOP
          : Curve.Position.NEAR_HEAD;
      const endY = (note: StaveNote) =>
        note.getStemExtents()[end(note) === Curve.Position.NEAR_TOP ? "topY" : "baseY"];
      const x0 = from ? from.getTieRightX() : line[0].stave.getTieStartX();
      const x1 = to ? to.getTieLeftX() : line[line.length - 1].stave.getTieEndX();
      const [bowStart, bowEnd] = slurBow(line, above, x0, endY(first), x1, endY(last));
      // VexFlow bends a slur toward the stems of its last note; flip it when that's wrong.
      const curve = new Curve(from!, to!, {
        position: end(first),
        position_end: end(last),
        invert: above === (last.getStemDirection() === Stem.UP),
        y_shift: SLUR_GAP,
        cps: [
          { x: 0, y: bowStart },
          { x: 0, y: bowEnd },
        ],
      });
      ctx.save();
      ctx.setFillStyle(slurred[0].color);
      ctx.setStrokeStyle(slurred[0].color);
      curve.setContext(ctx).draw();
      ctx.restore();
    });
  });
}

/** How far a slur's ends sit off the notes they start and end on. */
const SLUR_GAP = 10;

/**
 * How far a slur from (x0, y0) to (x1, y1) should bow out at its start and at its end
 * (its two control points' offsets): more the longer it is, and on each side, enough to
 * clear every note under it. A high note just before a low last note lifts the end's
 * side alone, so the slur stays over it and then drops to the last note.
 */
function slurBow(line: Placed[], above: boolean, x0: number, y0: number, x1: number, y1: number) {
  const side = above ? -1 : 1;
  const [from, to] = [y0 + SLUR_GAP * side, y1 + SLUR_GAP * side];
  let start = Math.min(30, 10 + (x1 - x0) * 0.02);
  let end = start;
  for (const { note, rest } of line) {
    const t = (noteCenterX(note) - x0) / (x1 - x0);
    if (rest || t <= 0 || t >= 1) continue;
    const heads = note.getYs();
    const stemUp = note.getStemDirection() === Stem.UP;
    // The note's outer edge on the slur's side: a stem's tip, or the edge of its head.
    const edge = above
      ? stemUp
        ? note.getStemExtents().topY
        : Math.min(...heads) - 5
      : Math.max(...heads) + 5;
    const straight = from + (to - from) * t;
    const overlap = side * (edge + 4 * side - straight);
    // At t along it, the curve bulges out from the straight line between its ends by
    // 3t(1 - t) times a blend of the two offsets: (1 - t) of the start's, t of the end's.
    const u = Math.min(0.95, Math.max(0.05, t));
    const [weightStart, weightEnd] = [3 * (1 - u) * (1 - u) * u, 3 * (1 - u) * u * u];
    const short = overlap - (weightStart * start + weightEnd * end);
    if (short <= 0) continue;
    // Lift the side the note is nearer; lifting only adds to the bulge everywhere.
    if (u < 0.5) start += short / weightStart;
    else end += short / weightEnd;
  }
  return [Math.min(start, 150), Math.min(end, 150)];
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
