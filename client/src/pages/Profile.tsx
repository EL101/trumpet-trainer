import { useEffect, useState } from "react";
import { Box, Dialog, Flex, Grid, Heading, Portal, Spinner, Text } from "@chakra-ui/react";
import { RotateCcw, Trash2, Check } from "lucide-react";
import { AppShell } from "@/components/layout";
import { PitchText, Staff } from "@/components/music";
import {
  Bookplate,
  Button,
  Kicker,
  notify,
  RangeAxis,
  RangeSlider,
  SectionHeading,
  Stat,
} from "@/components/primitives";
import AvatarUpload from "@/components/AvatarUpload";
import LinkGoogleAccount from "@/components/LinkGoogleAccount";
import SignOut from "@/components/SignOut";
import { useAuth } from "@/auth/useAuth";
import { usePersistedState } from "@/hooks/usePersistedState";
import { formatLongDate, formatPitch } from "@/lib/format";
import { RANGE_LABELS } from "@/lib/generatorOptions";
import {
  changedRanges,
  DEFAULT_NOTE_RANGES,
  describeChanges,
  HORN_SPAN,
  isNoteRanges,
  moveEnd,
  noteName,
  SETTABLE_RANGES,
  type NoteRanges,
  type NoteSpan,
  type SettableRange,
} from "@/lib/noteRanges";
import { useProfile } from "@/profile/useProfile";
import type { ProfileStats } from "@/schema";
import { useSettings } from "@/settings/useSettings";
import { fetchStats } from "@/utils/profile";
import { resetScores } from "@/utils/scores";

/** Notes labelled under the range sliders: the horn's ends and each C between. */
const AXIS_MARKS = [54, 60, 72, 84, 91].map((midi) => ({
  value: midi,
  label: <PitchText>{noteName(midi)}</PitchText>,
}));

/** The range rows' columns: name, staff, slider; on phones the slider goes under. */
const ROW_COLUMNS = { base: "minmax(0, 1fr) 136px", md: "104px 136px minmax(0, 1fr)" };

/**
 * Profile and settings (mockup 3a, with the range rows of the profile canvas's C and the
 * save row of its A): the practice record on a bookplate, then the note ranges, which
 * apply once saved, and resetting practice data.
 */
export default function Profile() {
  const { user } = useAuth();
  const { profile, loading } = useProfile();
  const stats = useStats();

  if (!user || loading) {
    return (
      <AppShell>
        <Spinner size="xl" />
      </AppShell>
    );
  }

  return (
    <AppShell
      display="flex"
      flexDirection="column"
      gap="xl"
      pt="2xl"
      pb={0}
      px={{ base: "xl", lg: "56px" }}
    >
      <Bookplate
        display="grid"
        gridTemplateColumns={{
          base: "minmax(0, 1fr)",
          md: "auto minmax(0, 1fr)",
          xl: "auto minmax(0, 1fr) auto",
        }}
        alignItems="center"
        columnGap="2xl"
        rowGap="lg"
      >
        <AvatarUpload user={user} />
        <Flex direction="column" gap="6px" minWidth={0}>
          <Kicker>Practice record of</Kicker>
          <Heading as="h1" textStyle="display.lg" m={0} overflowWrap="anywhere">
            {profile?.isAnonymous ? "Guest" : (profile?.displayName ?? "Your profile")}
          </Heading>
          <Text textStyle="epigraph" color="fg.muted">
            <PitchText>B♭ trumpet</PitchText>
            {profile?.createdAt && ` · since ${formatLongDate(profile.createdAt)}`}
          </Text>
          {profile?.email && (
            <Text textStyle="meta" color="fg.muted">
              {profile.email}
            </Text>
          )}
          <Flex gap="sm" mt="sm" wrap="wrap">
            {profile?.isAnonymous && <LinkGoogleAccount user={user} />}
            <SignOut />
          </Flex>
        </Flex>
        <Grid
          gridColumn={{ md: "1 / -1", xl: "auto" }}
          templateColumns="repeat(2, auto)"
          justifyContent="start"
          columnGap="2xl"
          ps={{ xl: "2xl" }}
          pt={{ base: "lg", xl: 0 }}
          borderColor="accent.muted"
          borderLeftWidth={{ xl: "1px" }}
          borderTopWidth={{ base: "1px", xl: 0 }}
        >
          <Stat
            size="lg"
            value={stats.value?.exercisesGenerated ?? "–"}
            label="exercises generated"
          />
          <Stat size="lg" value={stats.value?.exercisesPlayed ?? "–"} label="exercises played" />
        </Grid>
      </Bookplate>

      <Settings
        played={stats.value?.exercisesPlayed}
        onReset={() => stats.update((s) => ({ ...s, exercisesPlayed: 0 }))}
      />
    </AppShell>
  );
}

/** The record's numbers, loaded with the page so they're current. */
function useStats() {
  const { user } = useAuth();
  const [value, setValue] = useState<ProfileStats | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    fetchStats(user, controller.signal)
      .then((stats) => {
        if (!controller.signal.aborted) setValue(stats);
      })
      .catch((error) => {
        if (!controller.signal.aborted) console.error("fetch stats error:", error);
      });
    return () => controller.abort();
  }, [user]);
  const update = (change: (stats: ProfileStats) => ProfileStats) =>
    setValue((prev) => (prev ? change(prev) : prev));
  return { value, update };
}

/**
 * The settings sheet and the row that saves it. Changes are a draft until saved, kept
 * for the tab (so a trip to another page, or a reload, doesn't lose them).
 */
function Settings({ played, onReset }: { played?: number; onReset: () => void }) {
  const { user } = useAuth();
  const { settings, status, save, reload } = useSettings();
  const saved = settings.noteRanges;
  const [draft, setDraft] = usePersistedState<NoteRanges | null>(
    `profileRanges:${user?.uid}`,
    null,
    { session: true, accept: (v): v is NoteRanges | null => v === null || isNoteRanges(v) },
  );
  const ready = status === "ready";
  const ranges = ready && draft ? draft : saved;
  const changed = ready ? changedRanges(saved, ranges) : [];
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);

  // A draft that's back where it was saved is no draft at all.
  const edit = (next: NoteRanges) => {
    setSaveFailed(false);
    setDraft(changedRanges(saved, next).length ? next : null);
  };

  // Closing the tab or reloading with changes unsaved asks first.
  const dirty = changed.length > 0;
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const onSave = async () => {
    setSaving(true);
    setSaveFailed(false);
    try {
      await save({ noteRanges: ranges });
      setDraft(null);
      notify({ tone: "success", title: "Settings saved" });
    } catch (error) {
      console.error("save settings error:", error);
      setSaveFailed(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Grid
        templateColumns={{ base: "minmax(0, 1fr)", lg: "minmax(0, 2fr) minmax(0, 1fr)" }}
        borderTopWidth="1px"
        borderColor="border"
      >
        <Flex
          as="section"
          aria-labelledby="note-ranges"
          direction="column"
          gap="xs"
          pt="lg"
          pb="lg"
          pe={{ lg: "xl" }}
          borderColor="border"
          borderRightWidth={{ lg: "1px" }}
        >
          <Flex align="flex-start" justify="space-between" gap="md" wrap="wrap">
            <SectionHeading
              id="note-ranges"
              as="h2"
              number={1}
              title="Note ranges"
              description="What Low, Medium and High cover when you generate, in written pitch. Ranges can overlap; each spans at least an octave."
              maxWidth="460px"
            />
            <Button
              variant="ghost"
              size="sm"
              disabled={!ready || changedRanges(ranges, DEFAULT_NOTE_RANGES).length === 0}
              onClick={() => edit(DEFAULT_NOTE_RANGES)}
            >
              <RotateCcw />
              Reset to default
            </Button>
          </Flex>
          {SETTABLE_RANGES.map((range) => (
            <RangeRow
              key={range}
              range={range}
              span={ranges[range]}
              saved={saved[range]}
              edited={changed.includes(range)}
              disabled={!ready || saving}
              onChange={(span) => edit({ ...ranges, [range]: span })}
            />
          ))}
          <Grid templateColumns={ROW_COLUMNS} columnGap="lg">
            <RangeAxis
              gridColumn={{ base: "1 / -1", md: "3" }}
              min={HORN_SPAN[0]}
              max={HORN_SPAN[1]}
              marks={AXIS_MARKS}
            />
          </Grid>
        </Flex>

        <Flex
          as="section"
          aria-labelledby="data"
          direction="column"
          align="flex-start"
          gap="md"
          pt="lg"
          pb="lg"
          ps={{ lg: "xl" }}
          borderColor="border"
          borderTopWidth={{ base: "1px", lg: 0 }}
        >
          <SectionHeading id="data" as="h2" number={2} title="Data" description="Can't be undone" />
          <Text textStyle="small" color="fg.muted">
            Deletes every practice score and sets exercises played back to 0. Your library, history
            and note ranges stay.
          </Text>
          <ResetPracticeData played={played} onReset={onReset} />
        </Flex>
      </Grid>

      <Flex
        position="sticky"
        bottom={0}
        zIndex={1}
        bg="bg"
        align="center"
        gap="sm"
        wrap="wrap"
        mt="auto"
        py="md"
        borderTopWidth="1px"
        borderColor="border"
      >
        <Text
          flex="1"
          minWidth="200px"
          textStyle="small"
          color={saveFailed || status === "failed" ? "fg.error" : "fg.muted"}
          role={saveFailed || status === "failed" ? "alert" : undefined}
          aria-live="polite"
        >
          {status === "loading" ? (
            "Loading your settings…"
          ) : status === "failed" ? (
            "Couldn't load your settings."
          ) : saveFailed ? (
            "Couldn't save your settings. Check your connection and try again."
          ) : dirty ? (
            <>
              <Text as="span" color="accent.fg" aria-hidden="true">
                ●{" "}
              </Text>
              {describeChanges(changed)} · not saved yet
            </>
          ) : (
            "All changes saved"
          )}
        </Text>
        {status === "failed" ? (
          <Button size="sm" onClick={reload}>
            Try again
          </Button>
        ) : (
          <>
            <Button
              variant="ghost"
              size="sm"
              disabled={!dirty || saving}
              onClick={() => edit(saved)}
            >
              Discard
            </Button>
            <Button variant="primary" size="sm" disabled={!dirty || saving} onClick={onSave}>
              <Check />
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </>
        )}
      </Flex>
    </>
  );
}

/**
 * One range: its name and notes, the two notes on a staff, and the slider that sets
 * them. While edited, the slider outlines where it was saved.
 */
function RangeRow({
  range,
  span,
  saved,
  edited,
  disabled,
  onChange,
}: {
  range: SettableRange;
  span: NoteSpan;
  saved: NoteSpan;
  edited: boolean;
  disabled: boolean;
  onChange: (span: NoteSpan) => void;
}) {
  const label = RANGE_LABELS[range];
  const [low, high] = span.map(noteName);
  return (
    <Grid
      templateColumns={ROW_COLUMNS}
      templateAreas={{ base: `"name staff" "slider slider"`, md: `"name staff slider"` }}
      columnGap="lg"
      alignItems="center"
      borderBottomWidth="1px"
      borderColor="border.subtle"
    >
      <Flex gridArea="name" direction="column" gap="2px">
        <Text textStyle="subheading">{label}</Text>
        <Text textStyle="epigraph" fontSize="16px" color="fg.muted">
          <PitchText>{`${low} – ${high}`}</PitchText>
        </Text>
        {edited && (
          <Text textStyle="meta" color="accent.fg">
            ● edited
          </Text>
        )}
      </Flex>
      <Box
        gridArea="staff"
        role="img"
        aria-label={`${label} range on the staff: ${formatPitch(low)} to ${formatPitch(high)}`}
      >
        <Staff
          notes={`${low}/w, ${high}/w`}
          timeSig="4/4"
          barlines={false}
          width={136}
          scale={0.6}
        />
      </Box>
      <RangeSlider
        gridArea="slider"
        value={span}
        min={HORN_SPAN[0]}
        max={HORN_SPAN[1]}
        reference={edited ? saved : undefined}
        labels={[`${label} range, lowest note`, `${label} range, highest note`]}
        valueText={(midi) => formatPitch(noteName(midi))}
        disabled={disabled}
        onChange={(next, end) => onChange(moveEnd(span, end, next[end]))}
      />
    </Grid>
  );
}

/** "Reset practice data", confirmed in a dialog first: every score goes, for good. */
function ResetPracticeData({ played, onReset }: { played?: number; onReset: () => void }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [failed, setFailed] = useState(false);

  const reset = async () => {
    setResetting(true);
    setFailed(false);
    try {
      const deleted = await resetScores(user);
      setOpen(false);
      onReset();
      notify({
        tone: "success",
        title: "Practice data reset",
        description: `Deleted ${deleted} score${deleted === 1 ? "" : "s"}.`,
      });
    } catch (error) {
      console.error("reset practice data error:", error);
      setFailed(true);
    } finally {
      setResetting(false);
    }
  };

  return (
    <Dialog.Root
      role="alertdialog"
      placement="center"
      open={open}
      onOpenChange={(e) => {
        if (resetting) return;
        if (e.open) setFailed(false);
        setOpen(e.open);
      }}
    >
      <Dialog.Trigger asChild>
        <Button variant="danger" size="sm" disabled={played === 0}>
          <Trash2 />
          Reset practice data
        </Button>
      </Dialog.Trigger>
      <Portal>
        <Dialog.Backdrop bg="bg.backdrop" />
        <Dialog.Positioner px="md">
          <Dialog.Content maxWidth="460px" p="lg" gap="md" borderWidth="1px" borderColor="border">
            <Kicker color="danger.fg">Can't be undone</Kicker>
            <Dialog.Title textStyle="heading.lg">Reset practice data?</Dialog.Title>
            <Dialog.Description textStyle="body">
              This deletes every practice score you've saved, with its feedback, and sets exercises
              played back to 0. There's no way to get them back.
            </Dialog.Description>
            <Text textStyle="small" color="fg.muted">
              Your library, history, exercises generated and note ranges aren't touched.
            </Text>
            {failed && (
              <Text role="alert" textStyle="small" color="fg.error">
                Couldn't reset your practice data. Check your connection and try again.
              </Text>
            )}
            <Flex justify="flex-end" gap="sm" mt="sm" wrap="wrap">
              <Dialog.ActionTrigger asChild>
                <Button disabled={resetting}>Keep my scores</Button>
              </Dialog.ActionTrigger>
              <Button variant="danger" disabled={resetting} onClick={reset}>
                <Trash2 />
                {resetting ? "Deleting…" : "Delete all scores"}
              </Button>
            </Flex>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}
