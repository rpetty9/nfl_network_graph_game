import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { isAdminSession } from "@/lib/admin";
import { pool } from "@/lib/db";
import { lineupSatisfiesPuzzleRules, playerAllowedByPuzzleRules } from "@/lib/puzzle-rules";
import { getLinkMultiplier } from "@/lib/scoring";
import { canonicalTeamAbbrSql, teamAbbrMatches } from "@/lib/team-abbr";
import { ensureTestingSubmissionTables } from "@/lib/testing";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type SlotRule = {
  slot_number: number;
  display_text: string;
  parameter_type: string;
  parameter_value: string | null;
  rule_name: string;
};

type CandidatePlayer = {
  player_id: string;
  player_name: string;
  primary_position: string | null;
  career_start_season: number | null;
  career_end_season: number | null;
  fantasy_points: number;
  theme_start_season: number | null;
  theme_end_season: number | null;
  super_bowl_win_count: number | null;
  draft_round: number | null;
  draft_year: number | null;
  undrafted_flag: boolean | null;
  headshot_url: string | null;
  player_colleges: string[];
  theme_team_abbrs: string[];
  theme_conferences: string[];
  theme_divisions: string[];
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
          ["RB", "WR", "TE"].includes(String(player.primary_position ?? "").toUpperCase())) ||
        String(player.primary_position ?? "").toUpperCase() === ruleValue
      );
    case "team":
      return (player.theme_team_abbrs ?? []).some((teamAbbr) =>
        teamAbbrMatches(String(teamAbbr), ruleValue)
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

function relationshipPasses(relationshipType: string, pair: PairRelationship | undefined) {
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

async function loadPuzzleContext(requestedDate: string, testingMode: boolean) {
  const puzzleResult = await pool.query(
    `
    SELECT puzzle_id, puzzle_date, title, theme_filter_id, relationship_rule_id, position_overlay_enabled, qb_exclusion_enabled
    FROM daily_puzzle
    WHERE puzzle_date = $1
      AND sport = 'nfl'
      ${testingMode ? "" : "AND puzzle_date <= ((NOW() AT TIME ZONE 'America/Chicago')::date)"}
    LIMIT 1
    `,
    [requestedDate]
  );

  const puzzle = puzzleResult.rows[0];
  if (!puzzle) {
    throw new Error("No puzzle found for that date.");
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
      SELECT dpsr.slot_number, srd.display_text, srd.parameter_type, srd.parameter_value, srd.rule_name
      FROM daily_puzzle_slot_rule dpsr
      JOIN slot_rule_definition srd ON dpsr.slot_rule_id = srd.slot_rule_id
      WHERE dpsr.puzzle_id = $1
      ORDER BY dpsr.slot_number
      `,
      [puzzle.puzzle_id]
    ),
  ]);

  return {
    puzzle: {
      ...puzzle,
      theme_display_name: themeResult.rows[0]?.display_name ?? "Unknown Theme",
    },
    themeRule: themeResult.rows[0]?.rule_logic_key ?? "seasons_2020_2025",
    relationshipRule: relationshipRuleResult.rows[0] ?? {
      relationship_type: "teammates",
      display_text: "Teammates",
      bonus_pct: 10,
    },
    slotRules: slotRulesResult.rows as SlotRule[],
    positionOverlayEnabled: Boolean(puzzle.position_overlay_enabled),
    qbExclusionEnabled: Boolean(puzzle.qb_exclusion_enabled),
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
            THEN s.season BETWEEN SUBSTRING($1 FROM '(\\d{4})')::int AND SUBSTRING($1 FROM '(\\d{4})')::int + 9
          WHEN $1 ~ '^season_range:\\d{4}-\\d{4}$'
            THEN s.season BETWEEN SUBSTRING($1 FROM '(\\d{4})')::int AND SUBSTRING($1 FROM '-(\\d{4})$')::int
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
      JOIN themed_seasons ts ON ps.season = ts.season
      JOIN eligible_players ep ON ps.player_id = ep.player_id
      GROUP BY ps.player_id
    ),
    player_slot_traits AS (
      SELECT
        p.player_id,
        ARRAY_REMOVE(ARRAY_AGG(DISTINCT t.team_abbr) FILTER (WHERE t.team_abbr IS NOT NULL), NULL) AS theme_team_abbrs,
        ARRAY_REMOVE(ARRAY_AGG(DISTINCT t.conference) FILTER (WHERE t.conference IS NOT NULL), NULL) AS theme_conferences,
        ARRAY_REMOVE(
          ARRAY_AGG(DISTINCT CONCAT_WS(' ', t.conference, t.division))
            FILTER (WHERE t.conference IS NOT NULL AND t.division IS NOT NULL),
          NULL
        ) AS theme_divisions
      FROM player_dim p
      JOIN eligible_players ep ON p.player_id = ep.player_id
      LEFT JOIN player_team_history pth ON p.player_id = pth.player_id
      LEFT JOIN team_dim t ON pth.team_id = t.team_id
      GROUP BY p.player_id
    ),
    player_college_traits AS (
      SELECT
        pch.player_id,
        ARRAY_REMOVE(ARRAY_AGG(DISTINCT pch.college_name), NULL) AS player_colleges
      FROM player_college_history pch
      GROUP BY pch.player_id
    )
    SELECT
      p.player_id::text,
      p.player_name,
      p.primary_position,
      p.career_start_season,
      p.career_end_season,
      pts.fantasy_points::float8 AS fantasy_points,
      pts.theme_start_season,
      pts.theme_end_season,
      p.super_bowl_win_count,
      p.draft_round,
      p.draft_year,
      p.undrafted_flag,
      p.headshot_url,
      COALESCE(pct.player_colleges, ARRAY[]::text[]) AS player_colleges,
      COALESCE(pst.theme_team_abbrs, ARRAY[]::text[]) AS theme_team_abbrs,
      COALESCE(pst.theme_conferences, ARRAY[]::text[]) AS theme_conferences,
      COALESCE(pst.theme_divisions, ARRAY[]::text[]) AS theme_divisions
    FROM player_theme_stats pts
    JOIN player_dim p ON pts.player_id = p.player_id
    LEFT JOIN player_slot_traits pst ON p.player_id = pst.player_id
    LEFT JOIN player_college_traits pct ON p.player_id = pct.player_id
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
            THEN s.season BETWEEN SUBSTRING($2 FROM '(\\d{4})')::int AND SUBSTRING($2 FROM '(\\d{4})')::int + 9
          WHEN $2 ~ '^season_range:\\d{4}-\\d{4}$'
            THEN s.season BETWEEN SUBSTRING($2 FROM '(\\d{4})')::int AND SUBSTRING($2 FROM '-(\\d{4})$')::int
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
      JOIN unnest($1::bigint[]) p2(player_id) ON p1.player_id < p2.player_id
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
            JOIN themed_seasons ts ON a.season = ts.season
            WHERE a.player_id = pb.player_id_1
              AND b.player_id = pb.player_id_2
          ) THEN true ELSE false
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
          JOIN player_team_history b ON COALESCE(a.franchise_id, -1) = COALESCE(b.franchise_id, -2)
          WHERE a.player_id = pb.player_id_1
            AND b.player_id = pb.player_id_2
            AND a.franchise_id IS NOT NULL
        ) THEN true ELSE false
      END AS same_franchise_flag,
      CASE
        WHEN EXISTS (
          SELECT 1
          FROM player_college_history c1
          JOIN player_college_history c2 ON c1.college_name = c2.college_name
          WHERE c1.player_id = pb.player_id_1
            AND c2.player_id = pb.player_id_2
        ) THEN true ELSE false
      END AS same_college_flag,
      CASE
        WHEN p1.draft_year IS NOT NULL
         AND COALESCE(p1.undrafted_flag, false) = false
         AND COALESCE(p2.undrafted_flag, false) = false
         AND p1.draft_year = p2.draft_year
        THEN true ELSE false
      END AS same_draft_class_flag,
      CASE WHEN p1.draft_round IS NOT NULL AND p1.draft_round = p2.draft_round THEN true ELSE false END AS same_draft_round_flag,
      CASE WHEN COALESCE(p1.undrafted_flag, false) = true AND COALESCE(p2.undrafted_flag, false) = true THEN true ELSE false END AS both_undrafted_flag,
      CASE WHEN p1.draft_round IS NOT NULL AND p2.draft_round IS NOT NULL AND p1.draft_round > 1 AND p2.draft_round > 1 THEN true ELSE false END AS both_non_first_round_pick_flag,
      CASE WHEN p1.draft_round BETWEEN 4 AND 7 AND p2.draft_round BETWEEN 4 AND 7 THEN true ELSE false END AS both_day_3_pick_flag,
      CASE WHEN COALESCE(p1.super_bowl_win_count, 0) > 0 AND COALESCE(p2.super_bowl_win_count, 0) > 0 THEN true ELSE false END AS both_super_bowl_winner_flag,
      CASE WHEN COALESCE(p1.super_bowl_win_count, 0) = 0 AND COALESCE(p2.super_bowl_win_count, 0) = 0 THEN true ELSE false END AS both_non_super_bowl_winner_flag,
      CASE
        WHEN EXISTS (
          SELECT 1 FROM player_team_history a JOIN team_dim ta ON a.team_id = ta.team_id
          WHERE a.player_id = pb.player_id_1 AND ${canonicalTeamAbbrSql("ta.team_abbr")} = 'GB'
        )
        AND EXISTS (
          SELECT 1 FROM player_team_history b JOIN team_dim tb ON b.team_id = tb.team_id
          WHERE b.player_id = pb.player_id_2 AND ${canonicalTeamAbbrSql("tb.team_abbr")} = 'GB'
        )
        THEN true ELSE false
      END AS both_played_packers_flag,
      CASE WHEN p1.primary_position IS NOT NULL AND p1.primary_position = p2.primary_position THEN true ELSE false END AS same_position_flag
    FROM pair_base pb
    LEFT JOIN teammate_flags tf ON pb.player_id_1 = tf.player_id_1 AND pb.player_id_2 = tf.player_id_2
    JOIN player_dim p1 ON p1.player_id = pb.player_id_1
    JOIN player_dim p2 ON p2.player_id = pb.player_id_2
    `,
    [playerIds, themeRule]
  );

  return result.rows as PairRelationship[];
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!isAdminSession(session)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const username = request.nextUrl.searchParams.get("username")?.trim() ?? "";
    const date = request.nextUrl.searchParams.get("date")?.trim() ?? "";
    const testingMode = request.nextUrl.searchParams.get("mode") === "testing";

    if (!username || !date) {
      return NextResponse.json(
        { error: "Username and date are required." },
        { status: 400 }
      );
    }

    if (testingMode) {
      await ensureTestingSubmissionTables(pool);
    }

    const userResult = await pool.query(
      `
      SELECT user_id::text, username
      FROM app_user
      WHERE username_normalized = $1
        AND username IS NOT NULL
      LIMIT 1
      `,
      [username.toLowerCase()]
    );

    const user = userResult.rows[0];
    if (!user) {
      return NextResponse.json({ error: "No exact username match found." }, { status: 404 });
    }

    const { puzzle, themeRule, relationshipRule, slotRules, positionOverlayEnabled, qbExclusionEnabled } =
      await loadPuzzleContext(date, testingMode);

    const submissionTable = testingMode ? "testing_submission" : "puzzle_submission";
    const submissionPlayerTable = testingMode
      ? "testing_submission_player"
      : "puzzle_submission_player";
    const submissionIdColumn = testingMode ? "testing_submission_id" : "submission_id";

    const submissionResult = await pool.query(
      `
      SELECT
        s.${submissionIdColumn}::text AS submission_id,
        s.display_name,
        s.base_score::text,
        s.active_links::text,
        s.multiplier::text,
        s.final_score::text,
        s.optimal_final_score::text,
        s.percent_of_optimal::text,
        s.submitted_at::text,
        au.username
      FROM ${submissionTable} s
      LEFT JOIN app_user au ON au.user_id = s.user_id
      WHERE s.puzzle_id = $1
        AND s.user_id = $2
      ORDER BY s.submitted_at DESC
      LIMIT 1
      `,
      [puzzle.puzzle_id, Number(user.user_id)]
    );

    const submission = submissionResult.rows[0];
    if (!submission) {
      return NextResponse.json({ error: "No submission found for that username and date." }, { status: 404 });
    }

    const lineupRows = await pool.query(
      `
      SELECT slot_number, player_id::text, fantasy_points::text
      FROM ${submissionPlayerTable}
      WHERE ${submissionIdColumn} = $1
      ORDER BY slot_number
      `,
      [Number(submission.submission_id)]
    );

    const players = await loadPlayersForTheme(themeRule);
    const playerMap = new Map(players.map((player) => [player.player_id, player]));
    const slotRuleMap = new Map(slotRules.map((rule) => [Number(rule.slot_number), rule]));

    const lineup = lineupRows.rows.map((row) => {
      const slotRule = slotRuleMap.get(Number(row.slot_number));
      const player = playerMap.get(String(row.player_id));
      if (!slotRule || !player) {
        throw new Error("Inspector could not resolve the saved lineup against the current puzzle data.");
      }

      return {
        slot_number: Number(row.slot_number),
        slot_rule: slotRule,
        submitted_fantasy_points: Number(row.fantasy_points),
        slot_match: playerMatchesSlotRule(player, slotRule),
        lineup_rule_match: playerAllowedByPuzzleRules(player.primary_position, {
          positionLockEnabled: positionOverlayEnabled,
          qbExclusionEnabled,
        }),
        player,
      };
    });

    const playerIds = lineup.map((entry) => Number(entry.player.player_id));
    const pairRelationships = await loadRelationships(playerIds, themeRule);
    const pairMap = new Map<string, PairRelationship>(
      pairRelationships.map((pair) => [getPairKey(pair.player_id_1, pair.player_id_2), pair])
    );

    const pairDebug = [];
    let recomputedActiveLinks = 0;
    for (let a = 0; a < lineup.length; a += 1) {
      for (let b = a + 1; b < lineup.length; b += 1) {
        const left = lineup[a];
        const right = lineup[b];
        const pair = pairMap.get(getPairKey(left.player.player_id, right.player.player_id));
        const activeForPuzzle = relationshipPasses(relationshipRule.relationship_type, pair);
        if (activeForPuzzle) recomputedActiveLinks += 1;
        pairDebug.push({
          player_id_1: left.player.player_id,
          player_name_1: left.player.player_name,
          player_id_2: right.player.player_id,
          player_name_2: right.player.player_name,
          active_for_puzzle: activeForPuzzle,
          flags: pair,
        });
      }
    }

    const recomputedBaseScore = lineup.reduce(
      (sum, entry) => sum + Number(entry.player.fantasy_points),
      0
    );
    const recomputedMultiplier = getLinkMultiplier(
      recomputedActiveLinks,
      Number(relationshipRule.bonus_pct ?? 10)
    );
    const recomputedFinalScore = recomputedBaseScore * recomputedMultiplier;
    const lineupRulePasses = lineupSatisfiesPuzzleRules(
      lineup.map((entry) => entry.player.primary_position),
      {
        positionLockEnabled: positionOverlayEnabled,
        qbExclusionEnabled,
      }
    );

    return NextResponse.json({
      lookup: {
        username: user.username,
        date,
        mode: testingMode ? "testing" : "production",
      },
      puzzle: {
        puzzle_id: String(puzzle.puzzle_id),
        puzzle_date: puzzle.puzzle_date,
        title: puzzle.title,
        theme_display_name: puzzle.theme_display_name,
        theme_rule_logic_key: themeRule,
        relationship_rule: relationshipRule,
        position_overlay_enabled: positionOverlayEnabled,
        qb_exclusion_enabled: qbExclusionEnabled,
        slot_rules: slotRules,
      },
      submission: {
        submission_id: submission.submission_id,
        display_name: submission.display_name,
        username: submission.username ?? null,
        submitted_at: submission.submitted_at,
        stored_base_score: Number(submission.base_score),
        stored_active_links: Number(submission.active_links),
        stored_multiplier: Number(submission.multiplier),
        stored_final_score: Number(submission.final_score),
        optimal_final_score:
          submission.optimal_final_score != null ? Number(submission.optimal_final_score) : null,
        percent_of_optimal:
          submission.percent_of_optimal != null ? Number(submission.percent_of_optimal) : null,
        recomputed_base_score: recomputedBaseScore,
        recomputed_active_links: recomputedActiveLinks,
        recomputed_multiplier: recomputedMultiplier,
        recomputed_final_score: recomputedFinalScore,
        lineup_rule_passes: lineupRulePasses,
      },
      lineup,
      pair_debug: pairDebug,
    });
  } catch (error) {
    console.error("Submission inspector route failed:", error);
    return NextResponse.json(
      { error: (error as Error).message || "Failed to inspect submission." },
      { status: 500 }
    );
  }
}
