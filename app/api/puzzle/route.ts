import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function formatDateValue(value: unknown): string | null {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  if (typeof value === "string") {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return value;
    }

    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString().slice(0, 10);
    }
  }

  return null;
}

export async function GET(request: NextRequest) {
  try {
    const requestedDate = request.nextUrl.searchParams.get("date");
    const puzzleResult = requestedDate
      ? await pool.query(
          `
          SELECT *
          FROM daily_puzzle
          WHERE puzzle_date = $1
            AND sport = 'nfl'
            AND puzzle_date <= ((NOW() AT TIME ZONE 'America/Chicago')::date)
          LIMIT 1
          `,
          [requestedDate]
        )
      : await pool.query(`
          SELECT *
          FROM daily_puzzle
          WHERE published_flag = true
            AND sport = 'nfl'
            AND puzzle_date <= ((NOW() AT TIME ZONE 'America/Chicago')::date)
          ORDER BY puzzle_date DESC
          LIMIT 1
        `);

    const puzzle = puzzleResult.rows[0];

    if (!puzzle) {
      return NextResponse.json({ error: "No puzzle found" }, { status: 404 });
    }

    const themeResult = await pool.query(
      `
      SELECT filter_id, filter_name, display_name, filter_category, rule_logic_key
      FROM filter_definition
      WHERE filter_id = $1
      `,
      [puzzle.theme_filter_id]
    );

    const eligibilityResult = await pool.query(
      `
      SELECT filter_id, filter_name, display_name, filter_category, rule_logic_key
      FROM filter_definition
      WHERE filter_id = $1
      `,
      [puzzle.eligibility_filter_id]
    );

    const multiplierResult = await pool.query(
      `
      SELECT multiplier_name, display_name
      FROM multiplier_definition
      WHERE multiplier_id = $1
      `,
      [puzzle.multiplier_id]
    );

    const relationshipRuleResult =
      puzzle.relationship_rule_id != null
        ? await pool.query(
            `
            SELECT relationship_type, display_text, bonus_pct
            FROM relationship_rule_definition
            WHERE relationship_rule_id = $1
            `,
            [puzzle.relationship_rule_id]
          )
        : { rows: [] };

    const statPoolResult = await pool.query(
      `
      SELECT s.stat_name, s.display_name
      FROM daily_puzzle_stat_pool p
      JOIN stat_definition s
        ON p.stat_id = s.stat_id
      WHERE p.puzzle_id = $1
      ORDER BY p.display_order
      `,
      [puzzle.puzzle_id]
    );
    const slotRulesResult = await pool.query(
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
    );

    const theme = themeResult.rows[0] ?? null;
    const eligibilityFilter = eligibilityResult.rows[0] ?? null;
    const multiplier = multiplierResult.rows[0] ?? null;
    const relationshipRule = relationshipRuleResult.rows[0] ?? null;
    const availableDatesResult = await pool.query(`
      SELECT puzzle_date
      FROM daily_puzzle
      WHERE sport = 'nfl'
        AND puzzle_date <= ((NOW() AT TIME ZONE 'America/Chicago')::date)
      ORDER BY puzzle_date DESC
    `);

    const board = {
      slot_count: 6,
      slots: [
        { slot_number: 1, label: "Slot 1" },
        { slot_number: 2, label: "Slot 2" },
        { slot_number: 3, label: "Slot 3" },
        { slot_number: 4, label: "Slot 4" },
        { slot_number: 5, label: "Slot 5" },
        { slot_number: 6, label: "Slot 6" },
      ],
      relationships: [
        {
          relationship_id: "rel_1_2",
          slot_a: 1,
          slot_b: 2,
          active: true,
          relationship_type:
            relationshipRule?.relationship_type ?? "teammates",
          display_text:
            relationshipRule?.display_text ?? "Must have been teammates",
        },
        {
          relationship_id: "rel_3_4",
          slot_a: 3,
          slot_b: 4,
          active: false,
          relationship_type: "inactive",
          display_text: "Inactive",
        },
        {
          relationship_id: "rel_5_6",
          slot_a: 5,
          slot_b: 6,
          active: false,
          relationship_type: "inactive",
          display_text: "Inactive",
        },
      ],
      parameters: [
        {
          parameter_id: "param_1",
          display_text: "TE",
          parameter_type: "position",
          parameter_value: "TE",
        },
        {
          parameter_id: "param_2",
          display_text: "Played until 33",
          parameter_type: "career_end_age",
          parameter_value: "33",
        },
        {
          parameter_id: "param_3",
          display_text: "AFC West team",
          parameter_type: "division",
          parameter_value: "AFC West",
        },
        {
          parameter_id: "param_4",
          display_text: "Any",
          parameter_type: "any",
          parameter_value: "ANY",
        },
        {
          parameter_id: "param_5",
          display_text: "Played for Titans",
          parameter_type: "team",
          parameter_value: "TEN",
        },
        {
          parameter_id: "param_6",
          display_text: "Drafted in 1st Round",
          parameter_type: "draft_round",
          parameter_value: "1",
        },
      ],
    };

    return NextResponse.json({
      puzzle: {
        ...puzzle,
        puzzle_date:
          formatDateValue(puzzle.puzzle_date) ?? String(puzzle.puzzle_date),
      },
      theme,
      eligibility_filter: eligibilityFilter,
      multiplier,
      relationship_rule: relationshipRule,
      stat_pool: statPoolResult.rows,
      slot_rules: slotRulesResult.rows,
      available_dates: availableDatesResult.rows
        .map((row) => formatDateValue(row.puzzle_date))
        .filter((dateValue): dateValue is string => Boolean(dateValue)),
      board,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Puzzle API failed" },
      { status: 500 }
    );
  }
}
