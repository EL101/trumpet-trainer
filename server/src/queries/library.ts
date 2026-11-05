import { prisma } from "../db.js";
import type { Prisma } from "../generated/prisma/client.js";
import { ExerciseType } from "../generated/prisma/enums.js";

/**
 * The names the library shows for each type, as in client/src/lib/generatorOptions.ts,
 * so a search for "long" finds long tones.
 */
const TYPE_LABELS: Record<ExerciseType, string> = {
  LONG_TONES: "Long tones",
  SCALES: "Scales",
  LIP_SLURS: "Lip slurs",
  ETUDES: "Etudes",
  RANDOM: "Random",
};

/** Types written without a key. Lip slurs are stored as C major, so their key isn't searched. */
const KEYLESS: ExerciseType[] = [ExerciseType.LIP_SLURS];

export type LibraryPageOptions = {
  /** Only this type, or every type. */
  type?: ExerciseType;
  /** Words that must each match the exercise's type, number, time signature or key. */
  query?: string;
  /** The exerciseId of the last entry the caller has: the page starts after it. */
  after?: string;
  limit: number;
};

/** `text` for a LIKE pattern, matching itself: Prisma's `contains` passes % and _ through. */
const literal = (text: string) => text.replace(/[\\%_]/g, "\\$&");

/**
 * Where one search word can match: the type's name, "No. 42" (a number matches it
 * exactly), the time signature, or the key, written with b/# or ♭/♯.
 */
function wordWhere(word: string): Prisma.LibraryWhereInput | null {
  // Every card reads "No. …", so a word inside that matches them all.
  if ("no.".includes(word)) return null;

  const types = (Object.keys(TYPE_LABELS) as ExerciseType[]).filter((type) =>
    TYPE_LABELS[type].toLowerCase().includes(word),
  );
  const key = literal(word.replace(/♭/g, "b").replace(/♯/g, "#"));
  const anyOf: Prisma.LibraryWhereInput[] = [
    { timeSig: { contains: literal(word), mode: "insensitive" } },
    { exerciseType: { notIn: KEYLESS }, musicKey: { contains: key, mode: "insensitive" } },
  ];
  if (types.length > 0) anyOf.push({ exerciseType: { in: types } });
  if (/^\d{1,9}$/.test(word)) anyOf.push({ generationNum: Number(word) });
  return { OR: anyOf };
}

/** The filter for a type and a search, every word of which must match. */
export function libraryWhere(
  userId: string,
  { type, query = "" }: Pick<LibraryPageOptions, "type" | "query">,
): Prisma.LibraryWhereInput {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const AND = words.map(wordWhere).filter((where) => where !== null);
  return { userId, ...(type && { exerciseType: type }), ...(AND.length > 0 && { AND }) };
}

/**
 * One page of the user's library, newest saved first, with how many entries match in
 * all. Pages follow on from the caller's last entry rather than an offset, so entries
 * removed from earlier pages don't make the next one skip any. Returns null when
 * `after` isn't in the library (removed elsewhere), as there's nowhere to follow on from.
 */
export async function listLibraryPage(
  userId: string,
  { after, limit, ...filter }: LibraryPageOptions,
) {
  const where = libraryWhere(userId, filter);
  if (after) {
    const cursor = await prisma.library.findUnique({
      where: { userId_exerciseId: { userId, exerciseId: after } },
      select: { id: true },
    });
    if (!cursor) return null;
  }

  const [rows, total] = await Promise.all([
    prisma.library.findMany({
      where,
      // The row id breaks ties, so an order that's the same every time can be followed on from.
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      ...(after && { cursor: { userId_exerciseId: { userId, exerciseId: after } }, skip: 1 }),
      // One more than asked for says whether there's another page.
      take: limit + 1,
    }),
    prisma.library.count({ where }),
  ]);
  return { entries: rows.slice(0, limit), total, hasMore: rows.length > limit };
}
