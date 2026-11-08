import type { UserSettings } from "../generated/prisma/client.js";
import { prisma } from "../db.js";
import { DEFAULT_NOTE_RANGES, SETTABLE_RANGES } from "../etudes/music.js";
import type { Settings } from "../schema/index.js";

const DEFAULTS: Settings = { noteRanges: DEFAULT_NOTE_RANGES };

/** A user's settings from their row, or the defaults when they have none. */
const fromRow = (row: UserSettings | null): Settings =>
  row
    ? {
        noteRanges: {
          LOW: [row.lowMin, row.lowMax],
          MED: [row.medMin, row.medMax],
          HIGH: [row.highMin, row.highMax],
        },
      }
    : DEFAULTS;

const toColumns = ({ noteRanges: { LOW, MED, HIGH } }: Settings) => ({
  lowMin: LOW[0],
  lowMax: LOW[1],
  medMin: MED[0],
  medMax: MED[1],
  highMin: HIGH[0],
  highMax: HIGH[1],
});

const isDefault = ({ noteRanges }: Settings) =>
  SETTABLE_RANGES.every(
    (range) =>
      noteRanges[range][0] === DEFAULT_NOTE_RANGES[range][0] &&
      noteRanges[range][1] === DEFAULT_NOTE_RANGES[range][1],
  );

/** The user's settings: their own, or the defaults if they've never saved any. */
export async function getSettings(userId: string): Promise<Settings> {
  return fromRow(await prisma.userSettings.findUnique({ where: { userId } }));
}

/**
 * Save the user's settings, all of them at once. Saving the defaults removes the row
 * instead, so the user keeps following the defaults if they change.
 */
export async function saveSettings(userId: string, settings: Settings): Promise<Settings> {
  if (isDefault(settings)) {
    await prisma.userSettings.deleteMany({ where: { userId } });
    return DEFAULTS;
  }
  const columns = toColumns(settings);
  const row = await prisma.userSettings.upsert({
    where: { userId },
    create: { userId, ...columns },
    update: columns,
  });
  return fromRow(row);
}
