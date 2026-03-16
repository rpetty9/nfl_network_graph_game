import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getLinkMultiplier } from "@/lib/scoring";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type SlotRule = {
  slot_number: number;
  slot_rule_id: string | number;
  rule_name: string;
  parameter_type: string;
  parameter_value: string | null;
  display_text: string;
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
  headshot_url?: string | null;
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
  both_super_bowl_winner_flag?: boolean;
  same_position_flag?: boolean;
};

type OptimalLineupResult = {
  lineup: Array<{
    slot_number: number;
    slot_rule: SlotRule;
    player: CandidatePlayer;
  }>;
  base_score: number;
  active_links: number;
  final_score: number;
};

const SLOT_LIMITS: Record<string, number> = {
  any: 18,
  position: 24,
  conference: 24,
  division: 22,
  team: 20,
  college: 18,
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
          ["RB", "WR", "TE"].includes(
            String(player.primary_position ?? "").toUpperCase()
          )) ||
        String(player.primary_position ?? "").toUpperCase() === ruleValue
      );
    case "team":
      return (player.theme_team_abbrs ?? []).some(
        (teamAbbr) => String(teamAbbr).toUpperCase() === ruleValue
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
    case "super_bowl_winner":
      return pair.both_super_bowl_winner_flag === true;
    case "same_position":
      return pair.same_position_flag === true;
    default:
      return false;
  }
}

export async function GET(request: NextRequest) {
  try {
    const requestedDate = request.nextUrl.searchParams.get("date");
    const puzzleResult = requestedDate
      ? await pool.query(
          `
          SELECT puzzle_id, puzzle_date, theme_filter_id, relationship_rule_id
          FROM daily_puzzle
          WHERE puzzle_date = $1
            AND sport = 'nfl'
          LIMIT 1
          `,
          [requestedDate]
        )
      : await pool.query(`
          SELECT puzzle_id, puzzle_date, theme_filter_id, relationship_rule_id
          FROM daily_puzzle
          WHERE published_flag = true
            AND sport = 'nfl'
          ORDER BY puzzle_date DESC
          LIMIT 1
        `);

    const puzzle = puzzleResult.rows[0];

    if (!puzzle) {
      return NextResponse.json({ error: "No puzzle found" }, { status: 404 });
    }

    const [themeResult, relationshipRuleResult, slotRulesResult] = await Promise.all([
      pool.query(
        `
        SELECT filter_id, display_name, rule_logic_key
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
          srd.slot_rule_id,
          srd.rule_name,
          srd.parameter_type,
          srd.parameter_value,
          srd.display_text
        FROM daily_puzzle_slot_rule dpsr
        JOIN slot_rule_definition srd
          ON dpsr.slot_rule_id = srd.slot_rule_id
        WHERE dpsr.puzzle_id = $1
        ORDER BY dpsr.slot_number
        `,
        [puzzle.puzzle_id]
      ),
    ]);

    const themeRule = themeResult.rows[0]?.rule_logic_key ?? "seasons_2020_2025";
    const relationshipRule = relationshipRuleResult.rows[0] ?? {
      relationship_type: "teammates",
      display_text: "Teammates",
      bonus_pct: 5,
    };

    const defaultSlotRules: SlotRule[] = [1, 2, 3, 4, 5].map((slotNumber) => ({
      slot_number: slotNumber,
      slot_rule_id: `default-${slotNumber}`,
      rule_name: slotNumber === 5 ? "flex_player" : "any_player",
      parameter_type: slotNumber === 5 ? "position" : "any",
      parameter_value: slotNumber === 5 ? "FLEX" : "ANY",
      display_text: slotNumber === 5 ? "Flex" : "Any",
    }));

    const slotRules: SlotRule[] =
      slotRulesResult.rows.length > 0 ? slotRulesResult.rows : defaultSlotRules;

    const playersResult = await pool.query(
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
        p.headshot_url,
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
      ORDER BY pts.fantasy_points DESC, p.player_name
      `,
      [themeRule]
    );

    const players: CandidatePlayer[] = playersResult.rows;
    const slotCandidates = slotRules.map((rule) => {
      const limit = SLOT_LIMITS[rule.parameter_type] ?? 20;
      return {
        ...rule,
        candidates: players
          .filter((player) => playerMatchesSlotRule(player, rule))
          .slice(0, limit),
      };
    });

    if (slotCandidates.some((slot) => slot.candidates.length === 0)) {
      return NextResponse.json(
        { error: "No valid candidate pool for one or more slots" },
        { status: 500 }
      );
    }

    const candidateIds = Array.from(
      new Set(
        slotCandidates.flatMap((slot) => slot.candidates.map((player) => Number(player.player_id)))
      )
    ).filter((id) => Number.isInteger(id) && id > 0);

    const pairRelationships: PairRelationship[] =
      candidateIds.length >= 2
        ? (
            await pool.query(
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
                SELECT
                  p1.player_id AS player_id_1,
                  p2.player_id AS player_id_2
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
                   AND p1.draft_year = p2.draft_year
                  THEN true
                  ELSE false
                END AS same_draft_class_flag,
                CASE
                  WHEN p1.draft_round IS NOT NULL
                   AND p1.draft_round = p2.draft_round
                  THEN true
                  ELSE false
                END AS same_draft_round_flag,
                CASE
                  WHEN COALESCE(p1.undrafted_flag, false) = true
                   AND COALESCE(p2.undrafted_flag, false) = true
                  THEN true
                  ELSE false
                 END AS both_undrafted_flag,
                 CASE
                   WHEN COALESCE(p1.super_bowl_win_count, 0) > 0
                    AND COALESCE(p2.super_bowl_win_count, 0) > 0
                   THEN true
                   ELSE false
                 END AS both_super_bowl_winner_flag,
                 CASE
                   WHEN p1.primary_position IS NOT NULL
                    AND p1.primary_position = p2.primary_position
                  THEN true
                  ELSE false
                END AS same_position_flag
              FROM pair_base pb
              LEFT JOIN teammate_flags tf
                ON pb.player_id_1 = tf.player_id_1
               AND pb.player_id_2 = tf.player_id_2
              JOIN player_dim p1
                ON p1.player_id = pb.player_id_1
              JOIN player_dim p2
                ON p2.player_id = pb.player_id_2
              `,
              [candidateIds, themeRule]
            )
          ).rows
        : [];

    const pairMap = new Map<string, PairRelationship>();
    pairRelationships.forEach((pair) => {
      pairMap.set(getPairKey(pair.player_id_1, pair.player_id_2), pair);
    });

    const orderedSlots = [...slotCandidates].sort(
      (a, b) => a.candidates.length - b.candidates.length
    );
    const remainingMaxBase = new Array<number>(orderedSlots.length).fill(0);

    for (let index = orderedSlots.length - 1; index >= 0; index -= 1) {
      const slotMax = orderedSlots[index].candidates[0]?.fantasy_points ?? 0;
      remainingMaxBase[index] =
        slotMax + (remainingMaxBase[index + 1] ?? 0);
    }

    let best: OptimalLineupResult | null = null;

    const chosen = new Map<number, CandidatePlayer>();
    const usedIds = new Set<string>();

    function search(index: number, currentBase: number) {
      const optimisticBase = currentBase + (remainingMaxBase[index] ?? 0);
      const optimisticScore = optimisticBase * getLinkMultiplier(
        10,
        Number(relationshipRule.bonus_pct ?? 5)
      );

      if (best && optimisticScore <= best.final_score) {
        return;
      }

      if (index >= orderedSlots.length) {
        const lineup = slotRules.map((rule) => ({
          slot_number: rule.slot_number,
          slot_rule: rule,
          player: chosen.get(rule.slot_number)!,
        }));

        let activeLinks = 0;
        for (let a = 0; a < lineup.length; a += 1) {
          for (let b = a + 1; b < lineup.length; b += 1) {
            const pair = pairMap.get(
              getPairKey(lineup[a].player.player_id, lineup[b].player.player_id)
            );
            if (relationshipPasses(relationshipRule.relationship_type, pair)) {
              activeLinks += 1;
            }
          }
        }

        const finalScore =
          currentBase *
          getLinkMultiplier(activeLinks, Number(relationshipRule.bonus_pct ?? 5));

        if (!best || finalScore > best.final_score) {
          best = {
            lineup,
            base_score: currentBase,
            active_links: activeLinks,
            final_score: finalScore,
          };
        }
        return;
      }

      const slot = orderedSlots[index];
      for (const candidate of slot.candidates) {
        if (usedIds.has(candidate.player_id)) continue;

        usedIds.add(candidate.player_id);
        chosen.set(slot.slot_number, candidate);
        search(index + 1, currentBase + Number(candidate.fantasy_points));
        chosen.delete(slot.slot_number);
        usedIds.delete(candidate.player_id);
      }
    }

    search(0, 0);

    if (!best) {
      return NextResponse.json(
        { error: "Failed to compute optimal lineup" },
        { status: 500 }
      );
    }

    const bestResult = best as OptimalLineupResult;

    return NextResponse.json({
      puzzle_date: String(puzzle.puzzle_date).slice(0, 10),
      relationship_rule: relationshipRule,
      candidate_pool_summary: slotCandidates.map((slot) => ({
        slot_number: slot.slot_number,
        display_text: slot.display_text,
        parameter_type: slot.parameter_type,
        candidate_count: slot.candidates.length,
      })),
      optimal_lineup: bestResult.lineup.map((entry: OptimalLineupResult["lineup"][number]) => ({
        slot_number: entry.slot_number,
        slot_rule: entry.slot_rule,
        player: entry.player,
      })),
      optimal_base_score: bestResult.base_score,
      optimal_active_links: bestResult.active_links,
      optimal_multiplier: getLinkMultiplier(
        bestResult.active_links,
        Number(relationshipRule.bonus_pct ?? 5)
      ),
      optimal_final_score: bestResult.final_score,
    });
  } catch (error) {
    console.error("Optimal lineup route failed:", error);
    return NextResponse.json(
      { error: "Failed to compute optimal lineup" },
      { status: 500 }
    );
  }
}
