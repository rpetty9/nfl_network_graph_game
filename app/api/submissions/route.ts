import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { awardBadgesForSubmission } from "@/lib/users";
import { pool } from "@/lib/db";
import { getLinkMultiplier } from "@/lib/scoring";
import { ensureTestingSubmissionTables, requireTestingAdmin } from "@/lib/testing";
import { canonicalTeamAbbrSql, teamAbbrMatches } from "@/lib/team-abbr";
import {
  lineupSatisfiesPuzzleRules,
  playerAllowedByPuzzleRules,
} from "@/lib/puzzle-rules";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type SlotRule = {
  slot_number: number;
  display_text: string;
  parameter_type: string;
  parameter_value: string | null;
};

type CandidatePlayer = {
  player_id: string;
  player_name: string;
  primary_position: string | null;
  career_start_season: number | null;
  career_end_season: number | null;
  super_bowl_win_count?: number | null;
  theme_start_season: number | null;
  theme_end_season: number | null;
  fantasy_points: number;
  player_colleges?: string[];
  theme_team_abbrs?: string[];
  theme_conferences?: string[];
  theme_divisions?: string[];
};

type PairRelationship = {
  player_id_1: string;
  player_id_2: string;
  were_teammates_flag: boolean;
  same_franchise_flag: boolean;
  same_college_flag: boolean;
  same_draft_class_flag: boolean;
  same_draft_round_flag?: boolean;
  both_undrafted_flag?: boolean;
  both_non_first_round_pick_flag?: boolean;
  both_day_3_pick_flag?: boolean;
  both_super_bowl_winner_flag?: boolean;
  both_non_super_bowl_winner_flag?: boolean;
  both_played_packers_flag?: boolean;
  same_position_flag?: boolean;
};

type ResolvedLineupEntry = {
  slotNumber: number;
  player: CandidatePlayer;
  rule: SlotRule;
};

type ExistingSubmissionRow = {
  submission_id: string;
  display_name: string;
  base_score: string;
  active_links: string;
  multiplier: string;
  final_score: string;
  optimal_final_score: string | null;
  percent_of_optimal: string | null;
};

async function loadSubmissionPlacement(input: {
  puzzleId: number | string;
  submissionId: number;
  testingMode?: boolean;
}) {
  const tableName = input.testingMode ? "testing_submission" : "puzzle_submission";
  const idColumn = input.testingMode ? "testing_submission_id" : "submission_id";
  const placementResult = await pool.query<{ placement: number }>(
    `
    SELECT placement
    FROM (
      SELECT
        ${idColumn} AS submission_id,
        ROW_NUMBER() OVER (
          ORDER BY final_score DESC, submitted_at ASC
        )::int AS placement
      FROM ${tableName}
      WHERE puzzle_id = $1
    ) ranked
    WHERE submission_id = $2
    LIMIT 1
    `,
    [Number(input.puzzleId), Number(input.submissionId)]
  );

  return placementResult.rows[0]?.placement ?? null;
}

type ExistingSubmissionPlayerRow = {
  slot_number: number;
  player_id: string;
};

async function loadCachedOptimalFinalScore(puzzleId: string | number) {
  const result = await pool.query<{ optimal_final_score: number | null }>(
    `
    SELECT
      CASE
        WHEN payload->>'optimal_final_score' IS NOT NULL
          THEN (payload->>'optimal_final_score')::float8
        ELSE NULL
      END AS optimal_final_score
    FROM optimal_lineup_cache
    WHERE puzzle_id = $1::bigint
    ORDER BY computed_at DESC
    LIMIT 1
    `,
    [Number(puzzleId)]
  );

  return result.rows[0]?.optimal_final_score ?? null;
}

const ADJECTIVES = [
  "Blitz",
  "Clutch",
  "Prime",
  "Quick",
  "Sky",
  "Stone",
  "Turbo",
  "Sharp",
  "Bold",
  "Flash",
];

const NOUNS = [
  "Routes",
  "Huddle",
  "Drive",
  "Rocket",
  "Audible",
  "Spiral",
  "Playbook",
  "Snap",
  "Rush",
  "Coverage",
];

function getPairKey(playerId1: string, playerId2: string) {
  return [String(playerId1), String(playerId2)].sort().join("|");
}

function playerMatchesSlotRule(player: CandidatePlayer, rule: SlotRule) {
  const ruleValue = String(rule.parameter_value ?? "").toUpperCase();

  switch (rule.parameter_type) {
    case "position":
      return (
        !ruleValue ||
        ruleValue === "ANY" ||
        (ruleValue === "FLEX" &&
          ["RB", "WR", "TE"].includes(
            String(player.primary_position ?? "").toUpperCase()
          )) ||
        String(player.primary_position ?? "").toUpperCase() === ruleValue
      );
    case "team":
      return (player.theme_team_abbrs ?? []).some(
        (teamAbbr) => teamAbbrMatches(String(teamAbbr), ruleValue)
      );
    case "conference":
      return (player.theme_conferences ?? []).some(
        (conference) => String(conference).toUpperCase() === ruleValue
      );
    case "division":
      return (player.theme_divisions ?? []).some(
        (division) => String(division).toUpperCase() === ruleValue
      );
    case "college":
      return (player.player_colleges ?? []).some(
        (college) => String(college).toUpperCase() === ruleValue
      );
    case "any":
    default:
      return true;
  }
}

function relationshipPasses(
  relationshipType: string,
  pair: PairRelationship | undefined
) {
  if (!pair) return false;

  switch (relationshipType) {
    case "teammates":
      return pair.were_teammates_flag === true;
    case "same_franchise":
      return pair.same_franchise_flag === true;
    case "same_college":
      return pair.same_college_flag === true;
    case "same_draft_class":
      return pair.same_draft_class_flag === true;
    case "same_draft_round":
      return pair.same_draft_round_flag === true;
    case "both_undrafted":
      return pair.both_undrafted_flag === true;
    case "non_first_round_pick":
      return pair.both_non_first_round_pick_flag === true;
    case "day_3_pick":
      return pair.both_day_3_pick_flag === true;
    case "super_bowl_winner":
      return pair.both_super_bowl_winner_flag === true;
    case "non_super_bowl_winner":
      return pair.both_non_super_bowl_winner_flag === true;
    case "played_for_packers":
      return pair.both_played_packers_flag === true;
    case "same_position":
      return pair.same_position_flag === true;
    default:
      return false;
  }
}

function makeDisplayName() {
  const adjective = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  const number = Math.floor(100 + Math.random() * 900);
  return `${adjective} ${noun} ${number}`;
}

function normalizeClientToken(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 120) return null;
  return trimmed;
}

async function loadExistingSubmission(input: {
  requestedDate: string | null;
  registeredUserId: string | null;
  clientToken: string | null;
  testingMode?: boolean;
}) {
  if (!input.registeredUserId && !input.clientToken) {
    throw new Error("Missing submission identity");
  }

  const { puzzle } = await loadPuzzleContext(input.requestedDate, input.testingMode);
  const identityClause = input.registeredUserId
    ? "user_id = $2"
    : "client_token = $2";
  const identityValue = input.registeredUserId
    ? Number(input.registeredUserId)
    : input.clientToken;

  const submissionResult = await pool.query<ExistingSubmissionRow>(
    `
    SELECT
      ${input.testingMode ? "testing_submission_id" : "submission_id"}::text AS submission_id,
      display_name,
      base_score::text,
      active_links::text,
      multiplier::text,
      final_score::text,
      optimal_final_score::text,
      percent_of_optimal::text
    FROM ${input.testingMode ? "testing_submission" : "puzzle_submission"}
    WHERE puzzle_id = $1
      AND ${identityClause}
    ORDER BY submitted_at DESC
    LIMIT 1
    `,
    [puzzle.puzzle_id, identityValue]
  );

  const submission = submissionResult.rows[0];
  if (!submission) {
    return null;
  }

  const lineupResult = await pool.query<ExistingSubmissionPlayerRow>(
    `
    SELECT
      slot_number,
      player_id::text
    FROM ${input.testingMode ? "testing_submission_player" : "puzzle_submission_player"}
    WHERE ${input.testingMode ? "testing_submission_id" : "submission_id"} = $1
    ORDER BY slot_number
    `,
    [Number(submission.submission_id)]
  );

  const placement = await loadSubmissionPlacement({
    puzzleId: puzzle.puzzle_id,
    submissionId: Number(submission.submission_id),
    testingMode: input.testingMode,
  });

  return {
    submission_id: Number(submission.submission_id),
    display_name: submission.display_name,
    base_score: Number(submission.base_score),
    active_links: Number(submission.active_links),
    multiplier: Number(submission.multiplier),
    final_score: Number(submission.final_score),
    optimal_final_score: submission.optimal_final_score
      ? Number(submission.optimal_final_score)
      : null,
    percent_of_optimal: submission.percent_of_optimal
      ? Number(submission.percent_of_optimal)
      : null,
    lineup: lineupResult.rows.map((row) => ({
      slot_number: Number(row.slot_number),
      player_id: row.player_id,
    })),
    placement,
    awarded_badges: [],
  };
}

async function loadPuzzleContext(
  requestedDate: string | null,
  testingMode = false
) {
  const puzzleResult = requestedDate
    ? await pool.query(
        `
        SELECT puzzle_id, puzzle_date, theme_filter_id, relationship_rule_id, position_overlay_enabled, qb_exclusion_enabled, rb_exclusion_enabled, wr_exclusion_enabled
        FROM daily_puzzle
        WHERE puzzle_date = $1
          AND sport = 'nfl'
          ${
            testingMode
              ? ""
              : "AND puzzle_date <= ((NOW() AT TIME ZONE 'America/Chicago')::date)"
          }
        LIMIT 1
        `,
        [requestedDate]
      )
    : await pool.query(`
        SELECT puzzle_id, puzzle_date, theme_filter_id, relationship_rule_id, position_overlay_enabled, qb_exclusion_enabled, rb_exclusion_enabled, wr_exclusion_enabled
        FROM daily_puzzle
        WHERE published_flag = true
          AND sport = 'nfl'
          AND puzzle_date <= ((NOW() AT TIME ZONE 'America/Chicago')::date)
        ORDER BY puzzle_date DESC
        LIMIT 1
      `);

  const puzzle = puzzleResult.rows[0];
  if (!puzzle) {
    throw new Error("No puzzle found");
  }

  const [themeResult, relationshipRuleResult, slotRulesResult] = await Promise.all([
    pool.query(
      `
      SELECT display_name, rule_logic_key
      FROM filter_definition
      WHERE filter_id = $1
      `,
      [puzzle.theme_filter_id]
    ),
    puzzle.relationship_rule_id != null
      ? pool.query(
          `
          SELECT relationship_type, display_text, bonus_pct
          FROM relationship_rule_definition
          WHERE relationship_rule_id = $1
          `,
          [puzzle.relationship_rule_id]
        )
      : Promise.resolve({ rows: [] }),
    pool.query(
      `
      SELECT
        dpsr.slot_number,
        srd.display_text,
        srd.parameter_type,
        srd.parameter_value
      FROM daily_puzzle_slot_rule dpsr
      JOIN slot_rule_definition srd
        ON dpsr.slot_rule_id = srd.slot_rule_id
      WHERE dpsr.puzzle_id = $1
      ORDER BY dpsr.slot_number
      `,
      [puzzle.puzzle_id]
    ),
  ]);

  return {
    puzzle,
    themeRule: themeResult.rows[0]?.rule_logic_key ?? "seasons_2020_2025",
    relationshipRule: relationshipRuleResult.rows[0] ?? {
      relationship_type: "teammates",
      display_text: "Teammates",
      bonus_pct: 10,
    },
    slotRules:
      slotRulesResult.rows.length > 0
        ? slotRulesResult.rows
        : [1, 2, 3, 4, 5].map((slotNumber) => ({
            slot_number: slotNumber,
            display_text: slotNumber === 5 ? "Flex" : "Any",
            parameter_type: slotNumber === 5 ? "position" : "any",
            parameter_value: slotNumber === 5 ? "FLEX" : "ANY",
          })),
    positionOverlayEnabled: Boolean(puzzle.position_overlay_enabled),
    qbExclusionEnabled: Boolean(puzzle.qb_exclusion_enabled),
    rbExclusionEnabled: Boolean((puzzle as { rb_exclusion_enabled?: unknown }).rb_exclusion_enabled),
    wrExclusionEnabled: Boolean((puzzle as { wr_exclusion_enabled?: unknown }).wr_exclusion_enabled),
  };
}

async function loadPlayersForTheme(themeRule: string) {
  const result = await pool.query(
    `
    WITH themed_seasons AS (
      SELECT s.season
      FROM season_dim s
      WHERE
        CASE
          WHEN $1 ~ '^decade:\\d{4}s$'
            THEN s.season BETWEEN
                 SUBSTRING($1 FROM '(\\d{4})')::int
                 AND SUBSTRING($1 FROM '(\\d{4})')::int + 9
          WHEN $1 ~ '^season_range:\\d{4}-\\d{4}$'
            THEN s.season BETWEEN
                 SUBSTRING($1 FROM '(\\d{4})')::int
                 AND SUBSTRING($1 FROM '-(\\d{4})$')::int
          WHEN $1 ~ '^season:\\d{4}$'
            THEN s.season = SUBSTRING($1 FROM '(\\d{4})')::int
          WHEN $1 = 'seasons_2010s' THEN s.season BETWEEN 2010 AND 2019
          WHEN $1 = 'seasons_2000s' THEN s.season BETWEEN 2000 AND 2009
          WHEN $1 = 'seasons_2010_2015' THEN s.season BETWEEN 2010 AND 2015
          WHEN $1 = 'seasons_2020_2025' THEN s.season BETWEEN 2020 AND 2025
          WHEN $1 = 'season_2012' THEN s.season = 2012
          ELSE true
        END
    ),
    eligible_players AS (
      SELECT p.player_id
      FROM player_dim p
      WHERE p.primary_position IN ('QB', 'RB', 'WR', 'TE')
    ),
    player_theme_stats AS (
      SELECT
        ps.player_id,
        MIN(ps.season) AS theme_start_season,
        MAX(ps.season) AS theme_end_season,
        SUM(
          COALESCE(ps.passing_yards, 0) / 25.0 +
          COALESCE(ps.passing_td, 0) * 4.0 +
          COALESCE(ps.rushing_yards, 0) / 10.0 +
          COALESCE(ps.rushing_td, 0) * 6.0 +
          COALESCE(ps.receiving_yards, 0) / 10.0 +
          COALESCE(ps.receiving_td, 0) * 6.0 +
          COALESCE(ps.receptions, 0) * 1.0
        )::numeric(12,2) AS fantasy_points
      FROM player_season_stats ps
      JOIN themed_seasons ts
        ON ps.season = ts.season
      JOIN eligible_players ep
        ON ps.player_id = ep.player_id
      GROUP BY ps.player_id
    ),
    player_slot_traits AS (
      SELECT
        p.player_id,
        ARRAY_REMOVE(
          ARRAY_AGG(DISTINCT t.team_abbr)
            FILTER (WHERE t.team_abbr IS NOT NULL),
          NULL
        ) AS theme_team_abbrs,
        ARRAY_REMOVE(
          ARRAY_AGG(DISTINCT t.conference)
            FILTER (WHERE t.conference IS NOT NULL),
          NULL
        ) AS theme_conferences,
        ARRAY_REMOVE(
          ARRAY_AGG(DISTINCT CONCAT_WS(' ', t.conference, t.division))
            FILTER (
              WHERE t.conference IS NOT NULL
                AND t.division IS NOT NULL
            ),
          NULL
        ) AS theme_divisions
      FROM player_dim p
      JOIN eligible_players ep
        ON p.player_id = ep.player_id
      LEFT JOIN player_team_history pth
        ON p.player_id = pth.player_id
      LEFT JOIN team_dim t
        ON pth.team_id = t.team_id
      GROUP BY p.player_id
    ),
    player_college_traits AS (
      SELECT
        pch.player_id,
        ARRAY_REMOVE(
          ARRAY_AGG(DISTINCT pch.college_name),
          NULL
        ) AS player_colleges
      FROM player_college_history pch
      GROUP BY pch.player_id
    )
    SELECT
      p.player_id::text,
        p.player_name,
        p.primary_position,
        p.career_start_season,
        p.career_end_season,
        p.super_bowl_win_count,
        pts.theme_start_season,
      pts.theme_end_season,
      pts.fantasy_points::float8 AS fantasy_points,
      COALESCE(pct.player_colleges, ARRAY[]::text[]) AS player_colleges,
      COALESCE(pst.theme_team_abbrs, ARRAY[]::text[]) AS theme_team_abbrs,
      COALESCE(pst.theme_conferences, ARRAY[]::text[]) AS theme_conferences,
      COALESCE(pst.theme_divisions, ARRAY[]::text[]) AS theme_divisions
    FROM player_theme_stats pts
    JOIN player_dim p
      ON pts.player_id = p.player_id
    LEFT JOIN player_slot_traits pst
      ON p.player_id = pst.player_id
    LEFT JOIN player_college_traits pct
      ON p.player_id = pct.player_id
    `,
    [themeRule]
  );

  return result.rows as CandidatePlayer[];
}

async function loadRelationships(playerIds: number[], themeRule: string) {
  if (playerIds.length < 2) return [] as PairRelationship[];

  const result = await pool.query(
    `
    WITH themed_seasons AS (
      SELECT s.season
      FROM season_dim s
      WHERE
        CASE
          WHEN $2 ~ '^decade:\\d{4}s$'
            THEN s.season BETWEEN
                 SUBSTRING($2 FROM '(\\d{4})')::int
                 AND SUBSTRING($2 FROM '(\\d{4})')::int + 9
          WHEN $2 ~ '^season_range:\\d{4}-\\d{4}$'
            THEN s.season BETWEEN
                 SUBSTRING($2 FROM '(\\d{4})')::int
                 AND SUBSTRING($2 FROM '-(\\d{4})$')::int
          WHEN $2 ~ '^season:\\d{4}$'
            THEN s.season = SUBSTRING($2 FROM '(\\d{4})')::int
          WHEN $2 = 'seasons_2010s' THEN s.season BETWEEN 2010 AND 2019
          WHEN $2 = 'seasons_2000s' THEN s.season BETWEEN 2000 AND 2009
          WHEN $2 = 'seasons_2010_2015' THEN s.season BETWEEN 2010 AND 2015
          WHEN $2 = 'seasons_2020_2025' THEN s.season BETWEEN 2020 AND 2025
          WHEN $2 = 'season_2012' THEN s.season = 2012
          ELSE true
        END
    ),
    pair_base AS (
      SELECT p1.player_id AS player_id_1, p2.player_id AS player_id_2
      FROM unnest($1::bigint[]) p1(player_id)
      JOIN unnest($1::bigint[]) p2(player_id)
        ON p1.player_id < p2.player_id
    ),
    teammate_flags AS (
      SELECT
        pb.player_id_1,
        pb.player_id_2,
        CASE
          WHEN EXISTS (
            SELECT 1
            FROM player_team_history a
            JOIN player_team_history b
              ON a.season = b.season
             AND a.team_id = b.team_id
            JOIN themed_seasons ts
              ON a.season = ts.season
            WHERE a.player_id = pb.player_id_1
              AND b.player_id = pb.player_id_2
          )
          THEN true
          ELSE false
        END AS were_teammates_flag
      FROM pair_base pb
    )
    SELECT
      pb.player_id_1::text,
      pb.player_id_2::text,
      tf.were_teammates_flag,
      CASE
        WHEN EXISTS (
          SELECT 1
          FROM player_team_history a
          JOIN player_team_history b
            ON COALESCE(a.franchise_id, -1) = COALESCE(b.franchise_id, -2)
          WHERE a.player_id = pb.player_id_1
            AND b.player_id = pb.player_id_2
            AND a.franchise_id IS NOT NULL
        )
        THEN true
        ELSE false
      END AS same_franchise_flag,
      CASE
        WHEN EXISTS (
          SELECT 1
          FROM player_college_history c1
          JOIN player_college_history c2
            ON c1.college_name = c2.college_name
          WHERE c1.player_id = pb.player_id_1
            AND c2.player_id = pb.player_id_2
        )
        THEN true
        ELSE false
      END AS same_college_flag,
      CASE
        WHEN p1.draft_year IS NOT NULL
         AND COALESCE(p1.undrafted_flag, false) = false
         AND COALESCE(p2.undrafted_flag, false) = false
         AND p1.draft_year = p2.draft_year
        THEN true
        ELSE false
      END AS same_draft_class_flag,
      CASE WHEN p1.draft_round IS NOT NULL AND p1.draft_round = p2.draft_round THEN true ELSE false END AS same_draft_round_flag,
        CASE WHEN COALESCE(p1.undrafted_flag, false) = true AND COALESCE(p2.undrafted_flag, false) = true THEN true ELSE false END AS both_undrafted_flag,
        CASE WHEN p1.draft_round IS NOT NULL AND p2.draft_round IS NOT NULL AND p1.draft_round > 1 AND p2.draft_round > 1 THEN true ELSE false END AS both_non_first_round_pick_flag,
        CASE WHEN p1.draft_round BETWEEN 4 AND 7 AND p2.draft_round BETWEEN 4 AND 7 THEN true ELSE false END AS both_day_3_pick_flag,
        CASE WHEN COALESCE(p1.super_bowl_win_count, 0) > 0 AND COALESCE(p2.super_bowl_win_count, 0) > 0 THEN true ELSE false END AS both_super_bowl_winner_flag,
        CASE WHEN COALESCE(p1.super_bowl_win_count, 0) = 0 AND COALESCE(p2.super_bowl_win_count, 0) = 0 THEN true ELSE false END AS both_non_super_bowl_winner_flag,
        CASE WHEN EXISTS (
          SELECT 1 FROM player_team_history a JOIN team_dim ta ON a.team_id = ta.team_id
          WHERE a.player_id = pb.player_id_1 AND ${canonicalTeamAbbrSql("ta.team_abbr")} = 'GB'
        ) AND EXISTS (
          SELECT 1 FROM player_team_history b JOIN team_dim tb ON b.team_id = tb.team_id
          WHERE b.player_id = pb.player_id_2 AND ${canonicalTeamAbbrSql("tb.team_abbr")} = 'GB'
        ) THEN true ELSE false END AS both_played_packers_flag,
        CASE WHEN p1.primary_position IS NOT NULL AND p1.primary_position = p2.primary_position THEN true ELSE false END AS same_position_flag
    FROM pair_base pb
    LEFT JOIN teammate_flags tf
      ON pb.player_id_1 = tf.player_id_1
     AND pb.player_id_2 = tf.player_id_2
    JOIN player_dim p1 ON p1.player_id = pb.player_id_1
    JOIN player_dim p2 ON p2.player_id = pb.player_id_2
    `,
    [playerIds, themeRule]
  );

  return result.rows as PairRelationship[];
}

export async function POST(request: NextRequest) {
  try {
    let testingMode = false;
    try {
      testingMode = await requireTestingAdmin(request);
    } catch {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const session = await auth();
    const registeredUserId =
      session?.user?.id && /^\d+$/.test(session.user.id) ? session.user.id : null;
    const registeredUsername =
      session?.user?.username && session.user.username.trim()
        ? session.user.username.trim()
        : null;
    const body = await request.json();
    const requestedDate = typeof body?.date === "string" ? body.date : null;
    const clientToken = normalizeClientToken(body?.client_token);
    const lineup = Array.isArray(body?.lineup) ? body.lineup : [];
    const requestedOptimalFinalScore =
      typeof body?.optimal_final_score === "number"
        ? body.optimal_final_score
        : null;

    if (!registeredUserId && !clientToken) {
      return NextResponse.json(
        { error: "Missing submission identity" },
        { status: 400 }
      );
    }

    if (registeredUserId && !registeredUsername) {
      return NextResponse.json(
        { error: "Choose a username before tracking scores." },
        { status: 403 }
      );
    }

    if (lineup.length !== 5) {
      return NextResponse.json({ error: "Lineup must contain 5 slots" }, { status: 400 });
    }

    if (testingMode) {
      await ensureTestingSubmissionTables(pool);
    }

    const {
      puzzle,
      themeRule,
      relationshipRule,
      slotRules,
      positionOverlayEnabled,
      qbExclusionEnabled,
      rbExclusionEnabled,
      wrExclusionEnabled,
    } =
      await loadPuzzleContext(requestedDate, testingMode);

    const players = await loadPlayersForTheme(themeRule);
    const playerMap = new Map(players.map((player) => [String(player.player_id), player]));
    const slotRuleMap = new Map(slotRules.map((rule) => [Number(rule.slot_number), rule]));

    const selectedIds = new Set<string>();
    const resolvedLineup: ResolvedLineupEntry[] = lineup.map(
      (entry: { slot_number: number; player_id: string }) => {
      const slotNumber = Number(entry.slot_number);
      const playerId = String(entry.player_id);
      const rule = slotRuleMap.get(slotNumber);
      const player = playerMap.get(playerId);

      if (!rule || !player) {
        throw new Error("Invalid lineup entry");
      }
      if (selectedIds.has(playerId)) {
        throw new Error("Duplicate players are not allowed");
      }
      if (!playerMatchesSlotRule(player, rule)) {
        throw new Error("Player does not satisfy slot rule");
      }
      if (
        !playerAllowedByPuzzleRules(player.primary_position, {
          positionLockEnabled: positionOverlayEnabled,
          qbExclusionEnabled,
          rbExclusionEnabled,
          wrExclusionEnabled,
        })
      ) {
        throw new Error(
          qbExclusionEnabled
            ? "Quarterbacks are not allowed for this puzzle."
            : rbExclusionEnabled
              ? "Running backs are not allowed for this puzzle."
              : wrExclusionEnabled
                ? "Wide receivers are not allowed for this puzzle."
            : "Player does not satisfy the puzzle lineup rule."
        );
      }

      selectedIds.add(playerId);
      return { slotNumber, player, rule };
    });

    if (
      !lineupSatisfiesPuzzleRules(
        resolvedLineup.map((entry) => entry.player.primary_position),
        {
          positionLockEnabled: positionOverlayEnabled,
          qbExclusionEnabled,
          rbExclusionEnabled,
          wrExclusionEnabled,
        }
      )
    ) {
      throw new Error(
        positionOverlayEnabled
          ? "This puzzle requires exactly one QB, RB, WR, and TE, plus one extra RB/WR/TE in any slot."
          : qbExclusionEnabled
            ? "Quarterbacks are not allowed for this puzzle."
            : rbExclusionEnabled
              ? "Running backs are not allowed for this puzzle."
              : wrExclusionEnabled
                ? "Wide receivers are not allowed for this puzzle."
            : "Lineup does not satisfy the puzzle rules."
      );
    }

    const pairRelationships = await loadRelationships(
      resolvedLineup.map((entry) => Number(entry.player.player_id)),
      themeRule
    );
    const pairMap = new Map<string, PairRelationship>();
    pairRelationships.forEach((pair) => {
      pairMap.set(getPairKey(pair.player_id_1, pair.player_id_2), pair);
    });

    let activeLinks = 0;
    for (let a = 0; a < resolvedLineup.length; a += 1) {
      for (let b = a + 1; b < resolvedLineup.length; b += 1) {
        if (
          relationshipPasses(
            relationshipRule.relationship_type,
            pairMap.get(
              getPairKey(
                resolvedLineup[a].player.player_id,
                resolvedLineup[b].player.player_id
              )
            )
          )
        ) {
          activeLinks += 1;
        }
      }
    }

    const baseScore = resolvedLineup.reduce(
      (sum: number, entry: ResolvedLineupEntry) =>
        sum + Number(entry.player.fantasy_points),
      0
    );
    const multiplier = getLinkMultiplier(
      activeLinks,
      Number(relationshipRule.bonus_pct ?? 10)
    );
    const finalScore = baseScore * multiplier;
    const optimalFinalScore =
      requestedOptimalFinalScore ?? (await loadCachedOptimalFinalScore(puzzle.puzzle_id));
    const percentOfOptimal =
      optimalFinalScore && optimalFinalScore > 0
        ? (finalScore / optimalFinalScore) * 100
        : null;

    const displayName = registeredUsername ?? makeDisplayName();
    const submissionResult = await pool.query(
      `
      INSERT INTO ${testingMode ? "testing_submission" : "puzzle_submission"} (
        puzzle_id,
        user_id,
        client_token,
        display_name,
        base_score,
        active_links,
        multiplier,
        final_score,
      optimal_final_score,
      percent_of_optimal
    )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING
        ${testingMode ? "testing_submission_id" : "submission_id"} AS submission_id,
        display_name,
        submitted_at
      `,
      [
        puzzle.puzzle_id,
        registeredUserId ? Number(registeredUserId) : null,
        registeredUserId ? null : clientToken,
        displayName,
        baseScore,
        activeLinks,
        multiplier,
        finalScore,
        optimalFinalScore,
        percentOfOptimal,
      ]
    );

    const submission = submissionResult.rows[0];

    await pool.query(
      `
      INSERT INTO ${testingMode ? "testing_submission_player" : "puzzle_submission_player"} (
        ${testingMode ? "testing_submission_id" : "submission_id"},
        slot_number,
        player_id,
        fantasy_points
      )
      SELECT *
      FROM unnest($1::bigint[], $2::int[], $3::bigint[], $4::numeric[])
      `,
      [
        resolvedLineup.map(() => Number(submission.submission_id)),
        resolvedLineup.map((entry: ResolvedLineupEntry) => entry.slotNumber),
        resolvedLineup.map(
          (entry: ResolvedLineupEntry) => Number(entry.player.player_id)
        ),
        resolvedLineup.map(
          (entry: ResolvedLineupEntry) => Number(entry.player.fantasy_points)
        ),
      ]
    );

    const awardedBadges =
      !testingMode && registeredUserId != null
        ? await awardBadgesForSubmission({
            userId: registeredUserId,
            activeLinks,
            finalScore,
            optimalFinalScore,
          })
        : [];

    const placement = await loadSubmissionPlacement({
      puzzleId: puzzle.puzzle_id,
      submissionId: Number(submission.submission_id),
      testingMode,
    });

    return NextResponse.json({
      submission_id: submission.submission_id,
      display_name: submission.display_name,
      base_score: baseScore,
      active_links: activeLinks,
      multiplier,
      final_score: finalScore,
      optimal_final_score: optimalFinalScore,
      percent_of_optimal: percentOfOptimal,
      placement,
      submitted_at: submission.submitted_at,
      awarded_badges: awardedBadges,
    });
  } catch (error) {
    console.error("Submission route failed:", error);

    if ((error as { code?: string }).code === "23505") {
      return NextResponse.json(
        { error: "You already submitted for this puzzle." },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: (error as Error).message || "Failed to save submission" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    let testingMode = false;
    try {
      testingMode = await requireTestingAdmin(request);
    } catch {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const session = await auth();
    const registeredUserId =
      session?.user?.id && /^\d+$/.test(session.user.id) ? session.user.id : null;
    const requestedDate = request.nextUrl.searchParams.get("date");
    const clientToken = normalizeClientToken(
      request.nextUrl.searchParams.get("client_token")
    );

    const submission = await loadExistingSubmission({
      requestedDate,
      registeredUserId,
      clientToken,
      testingMode,
    });

    if (!submission) {
      return NextResponse.json({ error: "No submission found." }, { status: 404 });
    }

    return NextResponse.json(submission);
  } catch (error) {
    console.error("Submission fetch failed:", error);
    return NextResponse.json(
      { error: (error as Error).message || "Failed to load submission." },
      { status: 500 }
    );
  }
}
