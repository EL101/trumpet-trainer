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
  ModifierContext,
  Renderer,
  Stave,
  StaveNote,
  StaveTie,
  Stem,
  TickContext,
  Voice,
  type RenderContext,
} from "vexflow";
import { centsColor, formatCents } from "@/lib/intonation";
import { prefersReducedMotion } from "@/lib/motion";
import { roles } from "@/theme";
import { getKeySig } from "@/utils/generateMusic";
import type { Key } from "@/schema";
import { parseMeasures, resolveMeasuresPerLine, spellInKey, type Spelling } from "@/lib/notation";
import { barAt, buildTimeline, cursorAt, type Timeline } from "@/lib/timeline";
import {
  beamRuns,
  ghostPieces,
  silences,
  type GhostPiece,
  type PlayedMark,
  type RestMark,
} from "@/lib/transcribe";

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
  /**
   * The notes played, drawn on a cue-size staff under each line, where they were played
   * and with their note values: coloured by intonation if right, red if wrong. Positions
   * are in quarter notes from the top. Given (even empty), the played staff is drawn.
   */
  played?: readonly PlayedMark[];
  /**
   * Where silence after what's been played is known to, in quarter notes: the silences
   * before it are drawn as rests on the played staff. Omit for no rests (an excerpt).
   */
  playedTo?: number;
  /** Fractional note index for the playback cursor. */
  cursor?: number;
  /**
   * Makes the notes clickable: called with the index (rests counted) of the note clicked,
   * and while the pointer is dragged on along the staff, with each note it passes.
   */
  onNoteClick?: (index: number) => void;
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
/** How long labels take to slide in or out, and the staff to grow or shrink round them. */
const LABEL_MS = 100;
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
  played,
  playedTo,
  cursor,
  onNoteClick,
  annotate,
  labels,
  noteColor,
  barlines = true,
  ...rest
}: StaffProps) {
  const ref = useRef<HTMLDivElement>(null);
  // The note a drag is on, while the pointer's held down on the staff.
  const dragging = useRef<number | null>(null);
  const measuredWidth = useElementWidth(ref, width == null);
  const W = width ?? measuredWidth;

  // Labels taken away slide out before the staff is redrawn without them, and labels
  // added slide in (not for viewers who'd rather not see motion). Until labels are first
  // added or taken away, the staff's height doesn't animate, so it doesn't on load.
  const [lastLabels, setLastLabels] = useState(labels);
  const [leaving, setLeaving] = useState<readonly string[] | null>(null);
  const [labelsToggled, setLabelsToggled] = useState(false);
  if (labels !== lastLabels) {
    setLastLabels(labels);
    if (!labels !== !lastLabels) setLabelsToggled(true);
    setLeaving(!labels && lastLabels && !prefersReducedMotion() ? lastLabels : null);
  }
  const shownLabels = labels ?? leaving ?? undefined;
  const labelsDrawn = useRef(!!labels);

  useEffect(() => {
    if (!leaving) return;
    ref.current?.querySelectorAll<SVGElement>("[data-label]").forEach((el) => {
      el.style.animation = `sink-out ${LABEL_MS}ms ease-in forwards`;
    });
    const timer = setTimeout(() => setLeaving(null), LABEL_MS);
    return () => clearTimeout(timer);
  }, [leaving]);

  const measures = useMemo(() => parseMeasures(notes, timeSig), [notes, timeSig]);
  const perLine = resolveMeasuresPerLine(measuresPerLine, measures.length);
  const lineCount = Math.max(1, Math.ceil(measures.length / perLine));
  const showText = !!shownLabels || !!annotate;
  const lineHeight = showText ? ANNOTATED_LINE_HEIGHT : LINE_HEIGHT;
  const height = Math.ceil(lineCount * lineHeight * scale);
  // Notes far above or below the staff can reach past the lines' allotted height; the
  // drawing grows to fit them so they don't spill over neighbouring content.
  const [drawnHeight, setDrawnHeight] = useState(height);
  // The notes as last drawn, for the cursor, which moves every frame during playback and
  // so is drawn on its own rather than redrawing the staff.
  const [drawing, setDrawing] = useState<{
    ctx: RenderContext;
    svg: SVGSVGElement;
    placed: Placed[];
    cues: Cue[];
  } | null>(null);

  // How far the played notes reach above and below each line's played staff, so the
  // lines are spaced to fit them. Kept until it changes, so notes coming in during a run
  // don't each redraw the staff: only one reaching further than before does.
  const timeline = useMemo(() => buildTimeline(notes, timeSig), [notes, timeSig]);
  const playedKey = musicKey ? getKeySig(musicKey) : "C";
  const playedLayout = useMemo(() => {
    if (!played) return null;
    // Beamed by the meter's beat, as the written notes are (in quarter notes).
    const groups = Beam.getDefaultBeamGroups(timeSig).map((g) => g.value() * 4);
    return layoutPlayed(played, timeline, playedKey, groups);
  }, [played, timeline, playedKey, timeSig]);
  const reach = useMemo(
    () => (playedLayout ? playedReach(playedLayout, timeline, perLine, lineCount) : null),
    [playedLayout, timeline, perLine, lineCount],
  );
  const [playedRoom, setPlayedRoom] = useState(reach);
  if (!sameReach(reach, playedRoom)) setPlayedRoom(reach);

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

    const { placed, underSlurs, extent, cues } = drawMeasures(ctx, {
      measures,
      perLine,
      lineHeight,
      innerWidth: W / scale,
      keySig: musicKey ? getKeySig(musicKey) : "",
      timeSig,
      barlines,
      showText,
      playedRoom,
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
    drawCues(ctx, svg, cues);
    if (showText) {
      const riseIn = !!shownLabels && !labelsDrawn.current && !prefersReducedMotion();
      drawLabels(
        svg,
        placed,
        (i) =>
          shownLabels
            ? (shownLabels[i] ?? "")
            : cents?.[i] != null
              ? formatCents(cents[i]!, false)
              : "",
        riseIn,
        underSlurs,
      );
    }
    labelsDrawn.current = !!shownLabels;
    setDrawnHeight(fitToContent(svg, W, height, scale, extent));
    setDrawing({ ctx, svg, placed, cues });
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
    shownLabels,
    noteColor,
    showText,
    playedRoom,
  ]);

  // The played notes are drawn on their own too: while a run plays they come in as
  // they're heard. The room they take was left when the staff was drawn (`playedRoom`).
  useEffect(() => {
    if (!drawing || !playedLayout?.marks.length) return;
    const marks = drawPlayed(drawing.ctx, drawing.placed, drawing.cues, timeline, playedLayout);
    return () => marks.forEach((mark) => mark.remove());
  }, [drawing, playedLayout, timeline]);

  // And the silences between them, as rests.
  useEffect(() => {
    if (!drawing || !played || playedTo == null) return;
    const rests = silences(played, timeline, playedTo);
    const marks = drawRests(drawing.ctx, drawing.placed, drawing.cues, timeline, rests);
    return () => marks.forEach((mark) => mark.remove());
  }, [drawing, played, playedTo, timeline]);

  useEffect(() => {
    if (!drawing || cursor == null) return;
    const marks = drawCursor(drawing.svg, drawing.placed, drawing.cues, cursor);
    return () => marks.forEach((mark) => mark.remove());
  }, [drawing, cursor]);

  return (
    <Box
      ref={ref}
      width={width != null ? `${width}px` : "100%"}
      height={`${Math.max(height, drawnHeight)}px`}
      transitionProperty={labelsToggled ? "height" : undefined}
      transitionDuration={`${LABEL_MS}ms`}
      transitionTimingFunction="ease-out"
      _motionReduce={{ transition: "none" }}
      cursor={onNoteClick ? "pointer" : undefined}
      _active={onNoteClick ? { cursor: "grabbing" } : undefined}
      // Clicking moves to the note clicked, and dragging carries on to each note passed.
      // Sideways drags are the staff's; up and down still scroll the page on touch.
      userSelect={onNoteClick ? "none" : undefined}
      touchAction={onNoteClick ? "pan-y" : undefined}
      onPointerDown={
        onNoteClick &&
        ((e) => {
          if (e.button !== 0 || !drawing) return;
          const index = noteAt(drawing.svg, drawing.placed, e.clientX, e.clientY);
          if (index == null) return;
          e.currentTarget.setPointerCapture(e.pointerId);
          dragging.current = index;
          onNoteClick(index);
        })
      }
      onPointerMove={
        onNoteClick &&
        ((e) => {
          if (dragging.current == null || !drawing) return;
          const index = noteAt(drawing.svg, drawing.placed, e.clientX, e.clientY);
          if (index == null || index === dragging.current) return;
          dragging.current = index;
          onNoteClick(index);
        })
      }
      onLostPointerCapture={() => {
        dragging.current = null;
      }}
      {...rest}
    />
  );
}

/**
 * Grows the SVG to take in anything drawn above or below its `height`, and anything to
 * be drawn later within `extent` (played notes, in the drawing's own units), keeping the
 * staff where it was. Returns the new pixel height.
 */
function fitToContent(
  svg: SVGSVGElement,
  width: number,
  height: number,
  scale: number,
  extent: Reach,
) {
  if (typeof svg.getBBox !== "function") return height; // jsdom
  const box = svg.getBBox();
  const pad = 2;
  const top = Math.min(0, box.y - pad, extent.top - pad);
  const bottom = Math.max(height / scale, box.y + box.height + pad, extent.bottom + pad);
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
  /** Which line of music it's on, from 0. */
  line: number;
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
/** Room a tie's arc can take above a line's highest note (see `drawTies`). */
const TIE_ROOM = 14;

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
    /**
     * How far each line's played notes reach round its played staff (see `playedReach`),
     * to leave room for; null for no played staff.
     */
    playedRoom: Reach[] | null;
    colorFor: (index: number, isRest: boolean) => string;
  },
): {
  placed: Placed[];
  underSlurs: UnderSlur[];
  extent: Reach;
  /** Each line's played staff, if there is one. */
  cues: Cue[];
} {
  const { measures, perLine, lineHeight, innerWidth, keySig, timeSig, barlines, colorFor } = opts;
  const [beats, beatValue] = timeSig.split("/").map(Number);
  // Beam by the meter's beat (e.g. 3+3 in 6/8); VexFlow otherwise pairs eighths in every meter.
  const beamGroups = Beam.getDefaultBeamGroups(timeSig);
  const staveOpts = { space_above_staff_ln: 3, space_below_staff_ln: 3 };
  const placed: Placed[] = [];
  const lines: Bar[][] = [];
  const slurredLines = new Set<number>();
  const tiedLines = new Set<number>();
  let index = 0;

  // Build every line first (at y = 0) so each one's reach above and below the staff is
  // known before the lines are spaced out.
  for (let start = 0, line = 0; start < measures.length; start += perLine, line++) {
    const bars = measures.slice(start, start + perLine);
    const isLastLine = start + perLine >= measures.length;
    if (bars.flat().some((p) => p.slurStart || p.slurEnd)) slurredLines.add(line);
    // A tie can come in from the line before, too.
    if (bars.flat().some((p) => p.tied) || measures[start - 1]?.at(-1)?.tied) {
      tiedLines.add(line);
    }

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
          colorNote(n, color);
          const { rest, tied, slurStart, slurEnd } = bar[k];
          placed.push({ note: n, stave, line, color, rest, tied, slurStart, slurEnd });
        });
        return { stave, voice, beams };
      }),
    );
  }

  // Lines sit `lineHeight` apart, or further when one's low notes would meet the next's
  // high ones.
  let y = 0;
  let prevBottom = 0;
  // How far the played notes to be drawn reach: the drawing is fitted to take them in
  // as well as what's drawn now. (Infinite, so no played staff takes no room.)
  const extent = { top: Infinity, bottom: -Infinity };
  const cues: Cue[] = [];
  lines.forEach((bars, line) => {
    const written = lineExtent(bars, opts.showText, slurredLines.has(line), tiedLines.has(line));
    const room = opts.playedRoom?.[line];
    // The played staff sits under the written one's lowest marks, and its own highest.
    const cueTop = room ? written.bottom + CUE_GAP - room.top : 0;
    const top = written.top;
    const bottom = room ? cueTop + room.bottom : written.bottom;
    const gap = opts.playedRoom ? AFTER_CUE_GAP : LINE_GAP;
    if (line > 0) y = Math.max(y + lineHeight, y + prevBottom - top + gap);
    prevBottom = bottom;
    if (room) {
      const first = bars[0].stave;
      const last = bars[bars.length - 1].stave;
      // Its bars line up with the written ones; it starts where the written notes do.
      const xs = [
        first.getNoteStartX() - 10,
        ...bars.slice(1).map((b) => b.stave.getX()),
        last.getX() + last.getWidth(),
      ];
      cues.push({
        y: y + cueTop,
        x0: xs[0],
        x1: xs[xs.length - 1],
        staves: cueStaves(xs, y + cueTop),
      });
      extent.top = Math.min(extent.top, y + cueTop + room.top);
      extent.bottom = Math.max(extent.bottom, y + cueTop + room.bottom);
    }

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
  const underSlurs = drawSlurs(ctx, placed);
  return { placed, underSlurs, extent, cues };
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

/** How far marks reach above (`top`) and below (`bottom`), relative to a stave's y. */
type Reach = { top: number; bottom: number };

/**
 * How far a line's notes reach above and below the staff, relative to its stave's y:
 * note heads plus stems (a beam can stretch a stem a little past its usual length), the
 * arc over them if the line has slurs or ties.
 */
function lineExtent(bars: Bar[], showText: boolean, slurred: boolean, tied: boolean) {
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
  else if (tied) top -= TIE_ROOM;
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

/** A slur drawn under its notes: on which line (its staves' y), across which x, how low. */
type UnderSlur = { line: number; x0: number; x1: number; bottom: number };

/**
 * Draws each slur, from a note that starts one to the next that ends one, in the first
 * note's colour. It arcs over the notes, or under their heads if every stem points up. A
 * slur across a line break is drawn in parts: off the end of one line, into the next.
 * Returns the slurs drawn under their notes, so text written under them can clear them.
 */
function drawSlurs(ctx: RenderContext, placed: Placed[]): UnderSlur[] {
  const underSlurs: UnderSlur[] = [];
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
      if (!above) {
        const bottom = slurBottom(endY(first), endY(last), bowStart, bowEnd);
        underSlurs.push({ line: line[0].stave.getY(), x0, x1, bottom });
      }
    });
  });
  return underSlurs;
}

/**
 * The lowest point of a slur drawn under its notes, from ends at heights y0 and y1 with
 * the given bows (see `slurBow`): its curve's lowest sample, plus the slur's thickness.
 */
function slurBottom(y0: number, y1: number, bowStart: number, bowEnd: number) {
  const [from, to] = [y0 + SLUR_GAP, y1 + SLUR_GAP];
  let bottom = Math.max(from, to);
  for (let t = 0.05; t < 1; t += 0.05) {
    const u = 1 - t;
    const y =
      u ** 3 * from +
      3 * u * u * t * (from + bowStart) +
      3 * u * t * t * (to + bowEnd) +
      t ** 3 * to;
    bottom = Math.max(bottom, y);
  }
  return bottom + 2;
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

/**
 * How far a played note's marks reach from its head's centre, at full size (before
 * `CUE`), for the room left round the played staff: VexFlow's note head (half its
 * height, and a little), its stem, and a tie (its offset from the head and its bend).
 */
const PLAYED_HEAD = 7;
const PLAYED_STEM = Stem.HEIGHT;
const PLAYED_TIE = 17;
/** How far a tie between played notes bends (VexFlow's `cp1`; `cp2` is 4 more). */
const PLAYED_TIE_BEND = 8;
/** How far a beam over played notes slants at most, from one end to the other. */
const PLAYED_BEAM_SLANT = 5;
/** The played staff's size against the written one: cue size. */
const CUE = 0.7;
/** One space of the played staff; its lines run from its top (0) to 4 spaces down. */
const CUE_SPACE = 10 * CUE;
const CUE_HEIGHT = 4 * CUE_SPACE;
/** Clearance between the lowest mark of a line's written staff and its played staff's highest. */
const CUE_GAP = 8;
/**
 * More clearance after a played staff than between lines without one, so each sits
 * nearer the music it's under than the line after it.
 */
const AFTER_CUE_GAP = 30;

/**
 * Where a line's played staff is: its top line's y, from where to where it runs, and its
 * bars (VexFlow staves at full size, see `cueStaves`).
 */
type Cue = { y: number; x0: number; x1: number; staves: Stave[] };

/** How a played note is coloured: by its intonation if right, red if wrong, faint if still sounding. */
function playedColor(mark: PlayedMark) {
  if (mark.status === "wrong") return roles.intonation.bad;
  if (mark.status === "sounding") return roles.fg.subtle;
  return mark.cents != null ? centsColor(mark.cents) : roles.fg.DEFAULT;
}

/** A piece of a played note as the played staff draws it (see `layoutPlayed`). */
type PlayedHead = {
  /** The mark it's a piece of, as an index into the layout's `marks`. */
  mark: number;
  piece: GhostPiece;
  /** How it's spelt (`spellInKey`'s name, "Bb4"), and its head's place on the staff (3 the middle line). */
  name: string;
  line: number;
  /** The accidental drawn before it: only on a mark's first piece, where one's needed. */
  accidental: Spelling["accidental"];
  color: string;
  /** Its stem goes up. A beamed piece's goes its beam's way. */
  up: boolean;
  /** The beam it's under, as an index into the layout's `runs`; null for flags of its own. */
  run: number | null;
};

type PlayedLayout = { marks: readonly PlayedMark[]; heads: PlayedHead[]; runs: number[][] };

/**
 * The notes played as the played staff draws them: each as tied pieces (see
 * `ghostPieces`), spelt for the key with an accidental on its first piece where the key
 * signature, or a note played earlier in the bar, needs one, and coloured by
 * `playedColor`. Eighths and sixteenths that follow on within a beat group (`groups`,
 * see `beamRuns`) are beamed, as on the written staff: a beam's stems all go the way its
 * heads mostly sit (up from below the middle line); any other stem goes its own head's way.
 */
function layoutPlayed(
  marks: readonly PlayedMark[],
  timeline: Timeline,
  keySig: string,
  groups: readonly number[],
): PlayedLayout {
  // The notes played so far in each bar, as spelt: what sets each line's accidental.
  const inBar = new Map<number, string[]>();
  const heads = marks.flatMap((mark, m) => {
    const bar = barAt(timeline, Math.min(mark.start, timeline.end));
    const earlier = inBar.get(bar) ?? [];
    const { line, accidental, name } = spellInKey(mark.midi, keySig, earlier);
    inBar.set(bar, [...earlier, name]);
    const color = playedColor(mark);
    return ghostPieces(mark, timeline).map(
      (piece, i): PlayedHead => ({
        mark: m,
        piece,
        name,
        line,
        accidental: i === 0 ? accidental : "",
        color,
        up: line < 3,
        run: null,
      }),
    );
  });
  const runs = beamRuns(
    heads.map((h) => h.piece),
    timeline,
    groups,
  );
  runs.forEach((run, r) => {
    const up = run.reduce((sum, i) => sum + heads[i].line - 3, 0) < 0;
    for (const i of run) Object.assign(heads[i], { up, run: r });
  });
  return { marks, heads, runs };
}

/**
 * How far each line's played notes reach above and below its played staff's top line
 * (drawn as `drawPlayed` draws them: head, stem or beam, and the ties between a note's
 * pieces), taking in the staff itself, so the lines are spaced to fit them.
 */
function playedReach(
  { heads, runs }: PlayedLayout,
  timeline: Timeline,
  perLine: number,
  lineCount: number,
): Reach[] {
  const reach: Reach[] = Array.from({ length: lineCount }, () => ({
    top: 0,
    bottom: CUE_HEIGHT,
  }));
  const take = (piece: GhostPiece, top: number, bottom: number) => {
    const line = Math.floor(barAt(timeline, Math.min(piece.start, timeline.end)) / perLine);
    if (line >= lineCount) return;
    reach[line].top = Math.min(reach[line].top, top);
    reach[line].bottom = Math.max(reach[line].bottom, bottom);
  };
  const headY = (h: PlayedHead) => (5 - h.line) * CUE_SPACE;
  const stem = PLAYED_STEM * CUE;
  const edge = PLAYED_HEAD * CUE;
  const tie = PLAYED_TIE * CUE;
  heads.forEach((h, i) => {
    const y = headY(h);
    take(h.piece, y - edge, y + edge);
    if (h.run === null && h.piece.length < 4) {
      take(h.piece, y - (h.up ? stem : 0), y + (h.up ? 0 : stem));
    }
    // Ties arc on the side away from the first piece's stem.
    const first = heads.find((o) => o.mark === h.mark)!;
    const tied = h.piece.tied || heads[i - 1]?.mark === h.mark;
    if (tied) take(h.piece, y - (first.up ? 0 : tie), y + (first.up ? tie : 0));
  });
  // A beam lies a stem's length from the head furthest its way, and slants at most
  // PLAYED_BEAM_SLANT further.
  const slant = PLAYED_BEAM_SLANT * CUE;
  for (const run of runs) {
    const ys = run.map((i) => headY(heads[i]));
    const piece = heads[run[0]].piece;
    if (heads[run[0]].up) take(piece, Math.min(...ys) - stem - slant, -Infinity);
    else take(piece, Infinity, Math.max(...ys) + stem + slant);
  }
  return reach;
}

function sameReach(a: Reach[] | null, b: Reach[] | null) {
  if (!a || !b) return a === b;
  return a.length === b.length && a.every((r, i) => r.top === b[i].top && r.bottom === b[i].bottom);
}

/** Draws each line's played staff (its bars, from `cueStaves`), and what it is, at its left. */
function drawCues(ctx: RenderContext, svg: SVGSVGElement, cues: Cue[]) {
  if (!cues.length) return;
  // Barlines take the context's colour; the lines, the staves' own (`fill_style`).
  ctx.save();
  ctx.setFillStyle(roles.border.strong);
  ctx.setStrokeStyle(roles.border.strong);
  inCue(ctx, "data-played-staff", () =>
    cues.forEach((cue) => cue.staves.forEach((s) => s.setContext(ctx).draw())),
  );
  ctx.restore();
  for (const cue of cues) {
    const label = svgEl(
      "text",
      {
        x: cue.x0 - 6,
        y: cue.y + CUE_HEIGHT / 2 + 3,
        "text-anchor": "end",
        "data-played-label": "",
      },
      // In `style`, as page styles outrank the size given as an attribute.
      {
        fill: roles.fg.muted,
        "font-family": "var(--chakra-fonts-body)",
        "font-size": "7px",
        "letter-spacing": "0.6px",
      },
    );
    label.textContent = "PLAYED";
    svg.appendChild(label);
    // Said where it fits, before the staff: the first line's clef and time signature
    // leave room, a later line's clef alone may not.
    // (Not measured in jsdom, which has no layout.)
    const width = (label as SVGTextElement).getComputedTextLength?.() ?? 0;
    if (width > cue.x0 - 8) label.remove();
  }
}

/**
 * The played staff's bars, as VexFlow staves at full size (see `inCue`): one between
 * each pair of `xs` (where the line's bars start, and where the last ends), with its top
 * line at `y`. Its lines are faint; it has no clef, as it's read against the one above.
 */
function cueStaves(xs: readonly number[], y: number) {
  return xs.slice(0, -1).map(
    (x, i) =>
      new Stave(x / CUE, y / CUE, (xs[i + 1] - x) / CUE, {
        space_above_staff_ln: 0,
        space_below_staff_ln: 0,
        left_bar: i === 0,
        fill_style: roles.border.muted,
      }),
  );
}

/**
 * Draws what `draw` draws with VexFlow at full size, in a group scaled down to the played
 * staff's cue size: so everything on it is drawn in units of `x / CUE`. Returns the group.
 */
function inCue(ctx: RenderContext, attribute: string, draw: () => void) {
  const group = ctx.openGroup() as SVGGElement;
  group.setAttribute("transform", `scale(${CUE})`);
  group.setAttribute(attribute, "");
  draw();
  ctx.closeGroup();
  return group;
}

/** The bar of a line's played staff that `x` (in the drawing's units) falls in. */
function cueStaveAt(cue: Cue, x: number) {
  return cue.staves.find((s) => (s.getX() + s.getWidth()) * CUE > x) ?? cue.staves.at(-1)!;
}

/**
 * Puts `note` on `stave` (a bar of a played staff) with its head centred at `x` (in the
 * drawing's units), rather than where the formatter would space it: under the written
 * music, at the moment it was played.
 */
function placeAt(note: StaveNote, stave: Stave, x: number) {
  note.setStave(stave);
  note.addToModifierContext(new ModifierContext());
  const tick = new TickContext().addTickable(note).preFormat().setX(0);
  tick.setX(x / CUE - noteCenterX(note));
}

/** Colours a note all through: head, stem, flag, ledger lines and its accidental and dot. */
function colorNote(note: StaveNote, color: string) {
  const style = { fillStyle: color, strokeStyle: color };
  note.setStyle(style);
  note.setStemStyle(style);
  note.setFlagStyle(style);
  note.setLedgerLineStyle(style);
  note.getModifiers().forEach((m) => m.setStyle(style));
}

/** A piece's note value (`ghostPieces` gives only these) as a VexFlow duration. */
const PIECE_DURATIONS: Record<number, string> = {
  4: "w",
  3: "hd",
  2: "h",
  1.5: "qd",
  1: "q",
  0.75: "8d",
  0.5: "8",
  0.25: "16",
};
/** A rest's length (`silences` gives only these) as a VexFlow duration. */
const REST_DURATIONS: Record<number, string> = { 2: "h", 1: "q", 0.5: "8", 0.25: "16" };

/** A note spelt as `spellInKey` spells it ("Bb4") as a VexFlow key ("bb/4"). */
function vexKey(name: string) {
  const [, pitch, octave] = /^(.*?)(-?\d+)$/.exec(name)!;
  return `${pitch.toLowerCase()}/${octave}`;
}

/**
 * Draws each note played on its line's played staff (as `layoutPlayed` lays them out),
 * with VexFlow at cue size, where it was played and as long as it was held: as notes tied
 * across barlines, beamed by the beat, with an accidental on its first note where it
 * needs one. Returns what it drew, for removal.
 */
function drawPlayed(
  ctx: RenderContext,
  placed: Placed[],
  cues: Cue[],
  timeline: Timeline,
  { heads, runs }: PlayedLayout,
) {
  if (!placed.length || !cues.length || !heads.length) return [];
  const notes = heads.map((h) => {
    const duration = PIECE_DURATIONS[h.piece.length];
    const note = new StaveNote({
      keys: [vexKey(h.name)],
      duration,
      stem_direction: h.up ? Stem.UP : Stem.DOWN,
    });
    if (h.accidental) note.addModifier(new Accidental(h.accidental), 0);
    if (duration.endsWith("d")) Dot.buildAndAttach([note], { all: true });
    const at = Math.min(h.piece.start, timeline.end);
    const { x, placed: p } = xAt(placed, cursorAt(timeline, at));
    const cue = cues[p.line];
    placeAt(note, cueStaveAt(cue, x), x);
    colorNote(note, h.color);
    return { note, cue };
  });
  // Made before the notes are drawn, so they leave their stems and flags to the beam. A
  // beam slants with its notes, but at most PLAYED_BEAM_SLANT from one end to the other.
  const beams = runs.map((run) => {
    const beam = new Beam(
      run.map((i) => notes[i].note),
      false,
    );
    const span = notes[run[run.length - 1]].note.getStemX() - notes[run[0]].note.getStemX();
    const slope = PLAYED_BEAM_SLANT / Math.max(span, 1);
    beam.render_options.max_slope = slope;
    beam.render_options.min_slope = -slope;
    const color = heads[run[0]].color;
    beam.setStyle({ fillStyle: color, strokeStyle: color });
    return beam;
  });

  return [
    inCue(ctx, "data-played", () => {
      notes.forEach(({ note }) => note.setContext(ctx).draw());
      beams.forEach((beam) => beam.setContext(ctx).draw());
      // A tie from each piece of a note to the next, away from its first piece's stem.
      // Across a line break, it runs off the end of the one line and in from the next.
      heads.forEach((h, i) => {
        if (heads[i + 1]?.mark !== h.mark) return;
        const from = notes[i];
        const to = notes[i + 1];
        const halves =
          from.cue === to.cue
            ? [{ first_note: from.note, last_note: to.note }]
            : [
                { first_note: from.note, last_note: null },
                { first_note: null, last_note: to.note },
              ];
        const up = heads.find((o) => o.mark === h.mark)!.up;
        for (const { first_note, last_note } of halves) {
          const tie = new StaveTie({
            first_note,
            last_note,
            first_indices: [0],
            last_indices: [0],
          });
          tie.setDirection(up ? Stem.UP : Stem.DOWN);
          tie.render_options.cp1 = PLAYED_TIE_BEND;
          tie.render_options.cp2 = PLAYED_TIE_BEND + 4;
          tie.setStyle({ fillStyle: h.color, strokeStyle: h.color }).setContext(ctx).draw();
        }
      });
    }),
  ];
}

/**
 * Draws the silences in what was played (`rests`, from `silences`) on the played staff,
 * faint, with VexFlow at cue size: each where it falls, and a whole bar's rest in the
 * middle of its bar. Returns what it drew, for removal.
 */
function drawRests(
  ctx: RenderContext,
  placed: Placed[],
  cues: Cue[],
  timeline: Timeline,
  rests: readonly RestMark[],
) {
  if (!placed.length || !cues.length || !rests.length) return [];
  const notes = rests.map((rest) => {
    const { x: along, placed: p } = xAt(placed, cursorAt(timeline, rest.start));
    const x = rest.wholeBar ? (p.stave.getNoteStartX() + p.stave.getNoteEndX()) / 2 : along;
    const note = new StaveNote({
      // A whole bar's rest hangs from the line above the middle one.
      keys: [rest.wholeBar ? "d/5" : "b/4"],
      duration: `${rest.wholeBar ? "w" : REST_DURATIONS[rest.length]}r`,
    });
    placeAt(note, cueStaveAt(cues[p.line], x), x);
    colorNote(note, roles.fg.subtle);
    return note;
  });
  return [inCue(ctx, "data-rests", () => notes.forEach((note) => note.setContext(ctx).draw()))];
}

const CURSOR_BAND = 28;

/**
 * Where a fractional note index (`cursorAt`) falls across the staff, and the note it's
 * in. Through a note it glides towards the next one, or for a line's last note, towards
 * the line's end.
 */
function xAt(placed: Placed[], cursor: number) {
  const i0 = Math.max(0, Math.min(placed.length - 1, Math.floor(cursor)));
  const q0 = placed[i0];
  const q1 = placed[i0 + 1];
  const from = noteCenterX(q0.note);
  const to =
    q1 && q1.stave.getY() === q0.stave.getY()
      ? noteCenterX(q1.note)
      : Math.max(from, q0.stave.getNoteEndX() - CURSOR_BAND / 2);
  return { x: from + (to - from) * Math.min(1, Math.max(0, cursor - i0)), placed: q0 };
}

/**
 * Draws the cursor band and rule behind the notes (at `xAt`), down through the played
 * staff if there is one; returns them for removal.
 */
function drawCursor(svg: SVGSVGElement, placed: Placed[], cues: Cue[], cursor: number) {
  if (!placed.length) return [];
  const { x, placed: q0 } = xAt(placed, cursor);
  const top = q0.stave.getYForLine(0) - 20;
  const cue = cues[q0.line];
  const bottom = cue ? cue.y + CUE_HEIGHT + 12 : q0.stave.getYForLine(4) + 20;

  const band = svgEl(
    "rect",
    { x: x - CURSOR_BAND / 2, y: top, width: CURSOR_BAND, height: bottom - top, rx: 3 },
    { fill: roles.accent.cursor },
  );
  const rule = svgEl(
    "line",
    { x1: x, x2: x, y1: top, y2: bottom, "stroke-width": 1.25 },
    { stroke: roles.accent.solid },
  );
  svg.insertBefore(rule, svg.firstChild);
  svg.insertBefore(band, svg.firstChild);
  return [band, rule];
}

/** The note nearest a click: on the nearest line, the one whose head is nearest across. */
function noteAt(svg: SVGSVGElement, placed: Placed[], clientX: number, clientY: number) {
  const toDrawing = svg.getScreenCTM()?.inverse();
  if (!toDrawing || !placed.length) return null;
  const { x, y } = new DOMPoint(clientX, clientY).matrixTransform(toDrawing);
  const middle = (p: Placed) => (p.stave.getYForLine(0) + p.stave.getYForLine(4)) / 2;
  const line = placed.reduce((a, b) => (Math.abs(middle(b) - y) < Math.abs(middle(a) - y) ? b : a));
  let nearest: number | null = null;
  placed.forEach((p, i) => {
    if (p.stave.getY() !== line.stave.getY()) return;
    const dx = Math.abs(noteCenterX(p.note) - x);
    if (nearest === null || dx < Math.abs(noteCenterX(placed[nearest].note) - x)) nearest = i;
  });
  return nearest;
}

/**
 * Writes `textFor(i)` under each note, sliding the text up into place if `riseIn`, and
 * below any slur drawn under the notes there (`underSlurs`).
 */
function drawLabels(
  svg: SVGSVGElement,
  placed: Placed[],
  textFor: (i: number) => string,
  riseIn: boolean,
  underSlurs: UnderSlur[],
) {
  placed.forEach((p, i) => {
    if (p.rest) return;
    const text = textFor(i);
    if (!text) return;
    const x = noteCenterX(p.note);
    const slurs = underSlurs.filter((s) => s.line === p.stave.getY() && s.x0 <= x && x <= s.x1);
    const y = Math.max(
      p.stave.getYForLine(4) + 38,
      Math.max(...p.note.getYs()) + 24,
      ...slurs.map((s) => s.bottom + 12),
    );
    const color = p.color === roles.fg.DEFAULT ? roles.fg.muted : p.color;
    const t = svgEl(
      "text",
      { x, y, "text-anchor": "middle", "font-size": 10, "data-label": "" },
      {
        fill: color,
        "font-family": "var(--chakra-fonts-body)",
        "font-variant-numeric": "tabular-nums",
        ...(riseIn ? { animation: `rise-in ${LABEL_MS}ms ease-out backwards` } : {}),
      },
    );
    t.textContent = text;
    svg.appendChild(t);
  });
}
