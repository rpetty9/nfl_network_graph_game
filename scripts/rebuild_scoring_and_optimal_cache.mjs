import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    if (!line || line.trim().startsWith("#")) continue;
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    const value = rawValue.replace(/^['"]|['"]$/g, "");
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

loadEnvFile(path.join(repoRoot, ".env.local"));
loadEnvFile(path.join(repoRoot, ".env"));

const { pool } = await import("../lib/db.ts");
const { computePreviewPayload } = await import("../lib/dev-puzzle.ts");

function buildConfigSignature(
  puzzleId,
  themeRule,
  relationshipRule,
  slotRules,
  positionOverlayEnabled,
  qbExclusionEnabled
) {
  const slotSignature = slotRules
    .map(
      (rule) =>
        `${rule.slot_number}:${rule.slot_rule_id}:${rule.parameter_type}:${rule.parameter_value ?? ""}`
    )
    .join("|");

  return [
    "v5",
    String(puzzleId),
    themeRule,
    relationshipRule.relationship_type,
    String(relationshipRule.bonus_pct ?? 10),
    positionOverlayEnabled ? "overlay:on" : "overlay:off",
    qbExclusionEnabled ? "qb:off" : "qb:on",
    slotSignature,
  ].join("::");
}

function buildTrackerDoc(entries) {
  const runningPlayerCounts = {};
  const runningTimePeriodCounts = {};
  const runningLinkCounts = {};

  for (const entry of entries) {
    runningTimePeriodCounts[entry.theme] = (runningTimePeriodCounts[entry.theme] ?? 0) + 1;
    runningLinkCounts[entry.link] = (runningLinkCounts[entry.link] ?? 0) + 1;
    for (const playerName of entry.optimal_players) {
      runningPlayerCounts[playerName] = (runningPlayerCounts[playerName] ?? 0) + 1;
    }
  }

  return {
    updated_through: entries.at(-1)?.puzzle_date ?? null,
    days: entries,
    running_player_counts: Object.fromEntries(
      Object.entries(runningPlayerCounts).sort((a, b) => a[0].localeCompare(b[0]))
    ),
    running_time_period_counts: Object.fromEntries(
      Object.entries(runningTimePeriodCounts).sort((a, b) => a[0].localeCompare(b[0]))
    ),
    running_link_counts: Object.fromEntries(
      Object.entries(runningLinkCounts).sort((a, b) => a[0].localeCompare(b[0]))
    ),
  };
}

const client = await pool.connect();

try {
  await client.query(`
    UPDATE relationship_rule_definition
    SET bonus_pct = 10.00
  `);

  await client.query(`DELETE FROM optimal_lineup_cache`);

  const puzzlesResult = await client.query(`
    SELECT
      dp.puzzle_id::text,
      dp.puzzle_date::text,
      dp.title,
      dp.position_overlay_enabled,
      COALESCE(dp.qb_exclusion_enabled, false) AS qb_exclusion_enabled,
      fd.rule_logic_key AS theme_rule,
      fd.display_name AS theme_display_name,
      rrd.relationship_rule_id::text,
      rrd.relationship_type,
      rrd.display_text AS relationship_display_text,
      COALESCE(rrd.bonus_pct, 10)::float8 AS bonus_pct
    FROM daily_puzzle dp
    JOIN filter_definition fd
      ON dp.theme_filter_id = fd.filter_id
    LEFT JOIN relationship_rule_definition rrd
      ON dp.relationship_rule_id = rrd.relationship_rule_id
    WHERE dp.sport = 'nfl'
    ORDER BY dp.puzzle_date ASC, dp.puzzle_id ASC
  `);

  const trackerEntries = [];
  const activeLinkSummary = [];

  for (const puzzle of puzzlesResult.rows) {
    const slotResult = await client.query(
      `
      SELECT srd.slot_rule_id::text
      FROM daily_puzzle_slot_rule dpsr
      JOIN slot_rule_definition srd
        ON dpsr.slot_rule_id = srd.slot_rule_id
      WHERE dpsr.puzzle_id = $1::bigint
      ORDER BY dpsr.slot_number ASC
      `,
      [Number(puzzle.puzzle_id)]
    );

    if (slotResult.rows.length !== 5) {
      throw new Error(`Puzzle ${puzzle.puzzle_id} is missing slot rules.`);
    }

    const config = {
      title: String(puzzle.title ?? ""),
      startSeason: Number(String(puzzle.theme_rule).match(/\d{4}/)?.[0] ?? 0),
      endSeason: (() => {
        const matches = String(puzzle.theme_rule).match(/\d{4}/g) ?? [];
        return Number(matches[1] ?? matches[0] ?? 0);
      })(),
      relationshipRuleId: String(puzzle.relationship_rule_id ?? ""),
      slotRuleIds: slotResult.rows.map((row) => String(row.slot_rule_id)),
      positionOverlayEnabled: Boolean(puzzle.position_overlay_enabled),
      qbExclusionEnabled: Boolean(puzzle.qb_exclusion_enabled),
    };

    const preview = await computePreviewPayload(client, config);
    const configSignature = buildConfigSignature(
      puzzle.puzzle_id,
      preview.theme.rule_logic_key,
      preview.relationship_rule,
      preview.optimal_lineup.map((entry) => entry.slot_rule),
      config.positionOverlayEnabled,
      config.qbExclusionEnabled
    );

    await client.query(
      `
      INSERT INTO optimal_lineup_cache (puzzle_id, config_signature, payload, computed_at)
      VALUES ($1::bigint, $2, $3::jsonb, NOW())
      ON CONFLICT (puzzle_id)
      DO UPDATE SET
        config_signature = EXCLUDED.config_signature,
        payload = EXCLUDED.payload,
        computed_at = NOW()
      `,
      [
        Number(puzzle.puzzle_id),
        configSignature,
        JSON.stringify({
          puzzle_date: String(puzzle.puzzle_date).slice(0, 10),
          relationship_rule: preview.relationship_rule,
          candidate_pool_summary: preview.candidate_pool_summary,
          optimal_lineup: preview.optimal_lineup.map((entry) => ({
            slot_number: entry.slot_number,
            slot_rule: entry.slot_rule,
            player: entry.player,
            previous_optimal_usage_count: entry.previous_optimal_usage_count,
          })),
          optimal_base_score: preview.optimal_base_score,
          optimal_active_links: preview.optimal_active_links,
          optimal_multiplier: preview.optimal_multiplier,
          optimal_final_score: preview.optimal_final_score,
          position_overlay_enabled: preview.position_overlay_enabled,
          qb_exclusion_enabled: preview.qb_exclusion_enabled,
        }),
      ]
    );

    const puzzleDate = String(puzzle.puzzle_date).slice(0, 10);
    trackerEntries.push({
      puzzle_date: puzzleDate,
      title: String(puzzle.title ?? ""),
      theme: String(preview.theme.display_name),
      link: String(preview.relationship_rule.display_text),
      optimal_players: preview.optimal_lineup.map((entry) => entry.player.player_name),
    });
    activeLinkSummary.push({
      puzzle_date: puzzleDate,
      title: String(puzzle.title ?? ""),
      optimal_active_links: Number(preview.optimal_active_links),
      optimal_multiplier: Number(preview.optimal_multiplier),
      optimal_final_score: Number(preview.optimal_final_score),
    });
  }

  const trackerDoc = buildTrackerDoc(trackerEntries);
  fs.writeFileSync(
    path.join(repoRoot, "docs", "optimal-lineup-usage-tracker.json"),
    `${JSON.stringify(trackerDoc, null, 2)}\n`,
    "utf8"
  );

  await client.query(`
    UPDATE puzzle_submission ps
    SET
      multiplier = ROUND((1 + (ps.active_links * COALESCE(rrd.bonus_pct, 10) / 100.0))::numeric, 4),
      final_score = ROUND((ps.base_score * (1 + (ps.active_links * COALESCE(rrd.bonus_pct, 10) / 100.0)))::numeric, 2),
      optimal_final_score = NULLIF(oc.payload->>'optimal_final_score', '')::numeric,
      percent_of_optimal = CASE
        WHEN NULLIF(oc.payload->>'optimal_final_score', '')::numeric > 0
          THEN ROUND(
            (
              (ps.base_score * (1 + (ps.active_links * COALESCE(rrd.bonus_pct, 10) / 100.0)))
              / NULLIF(oc.payload->>'optimal_final_score', '')::numeric
            ) * 100,
            2
          )
        ELSE NULL
      END
    FROM daily_puzzle dp
    LEFT JOIN relationship_rule_definition rrd
      ON dp.relationship_rule_id = rrd.relationship_rule_id
    LEFT JOIN optimal_lineup_cache oc
      ON dp.puzzle_id = oc.puzzle_id
    WHERE ps.puzzle_id = dp.puzzle_id
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS testing_submission (
      testing_submission_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      puzzle_id BIGINT NOT NULL REFERENCES daily_puzzle(puzzle_id) ON DELETE CASCADE,
      user_id BIGINT REFERENCES app_user(user_id) ON DELETE SET NULL,
      client_token TEXT,
      display_name TEXT NOT NULL,
      base_score NUMERIC(12,2) NOT NULL,
      active_links INTEGER NOT NULL,
      multiplier NUMERIC(8,4) NOT NULL,
      final_score NUMERIC(12,2) NOT NULL,
      optimal_final_score NUMERIC(12,2),
      percent_of_optimal NUMERIC(8,2),
      submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await client.query(`
    UPDATE testing_submission ts
    SET
      multiplier = ROUND((1 + (ts.active_links * COALESCE(rrd.bonus_pct, 10) / 100.0))::numeric, 4),
      final_score = ROUND((ts.base_score * (1 + (ts.active_links * COALESCE(rrd.bonus_pct, 10) / 100.0)))::numeric, 2),
      optimal_final_score = NULLIF(oc.payload->>'optimal_final_score', '')::numeric,
      percent_of_optimal = CASE
        WHEN NULLIF(oc.payload->>'optimal_final_score', '')::numeric > 0
          THEN ROUND(
            (
              (ts.base_score * (1 + (ts.active_links * COALESCE(rrd.bonus_pct, 10) / 100.0)))
              / NULLIF(oc.payload->>'optimal_final_score', '')::numeric
            ) * 100,
            2
          )
        ELSE NULL
      END
    FROM daily_puzzle dp
    LEFT JOIN relationship_rule_definition rrd
      ON dp.relationship_rule_id = rrd.relationship_rule_id
    LEFT JOIN optimal_lineup_cache oc
      ON dp.puzzle_id = oc.puzzle_id
    WHERE ts.puzzle_id = dp.puzzle_id
  `);

  console.log(
    JSON.stringify(
      {
        updated_bonus_pct_to: 10,
        rebuilt_puzzles: activeLinkSummary.length,
        optimal_active_links: activeLinkSummary,
      },
      null,
      2
    )
  );
} finally {
  client.release();
  await pool.end();
}
