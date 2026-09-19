/**
 * engine.js — Royalty-split explainer (backlog #20).
 *
 * Deterministic, zero-dependency. Runs identically in Node (tests) and the
 * browser (demo). Question text is token-matched only — never executed,
 * interpolated into answers, or echoed.
 *
 * The hard rule: NO split percentage exists in the knowledge base, and none
 * is ever emitted. Writer/publishing splits for EVERY track — Diabolique
 * included — render as "UNVERIFIED — splits not cleared by the rights
 * holder." The engine never states who is owed what, never estimates
 * payments, never offers legal conclusions. It reports verifiable facts
 * from splits-data.json with evidence tiers and hands every question off
 * to Business Affairs.
 *
 * Verdicts: "info-ready" (we hold verifiable facts) or "insufficient-data".
 * There is no "settled" verdict for splits. There never will be.
 */
'use strict';

function loadData() {
  if (typeof require === 'function') {
    // Node: splits-data.json sits next to this file.
    return require('./splits-data.json');
  }
  if (typeof window !== 'undefined' && window.__CWI_SPLITS_DATA__) {
    return window.__CWI_SPLITS_DATA__;
  }
  throw new Error('splits data not available');
}

function normalize(s) {
  return String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9]/g, '');
}

const ASPECTS = ['all', 'master', 'publishing'];

function validAspect(a) {
  return ASPECTS.includes(a) ? a : 'all';
}

const ASPECT_LABELS = {
  all: 'Whole picture (master + publishing)',
  master: 'Master side only',
  publishing: 'Publishing side only',
};

function findTrack(query, data) {
  const n = normalize(query);
  if (!n) return { status: 'empty' };
  const tracks = data.tracks || [];
  const exact = tracks.find(
    (t) => normalize(t.title) === n || (t.aliases || []).some((a) => normalize(a) === n)
  );
  if (exact) return { status: 'found', track: exact };
  // Single unambiguous near-miss -> suggest, but do NOT answer for it.
  const partial = tracks.filter(
    (t) => normalize(t.title).includes(n) || n.includes(normalize(t.title))
  );
  if (partial.length === 1) return { status: 'suggest', track: partial[0] };
  return { status: 'unknown' };
}

function filterByAspect(facts, aspect) {
  if (aspect === 'all') return facts;
  return facts.filter((f) => !f.side || f.side === aspect);
}

/**
 * check(trackQuery, aspect) -> answer object.
 * Every answer carries the legal banner and the Business Affairs handoff.
 */
function check(trackQuery, aspect, data) {
  const d = data || loadData();
  const asp = validAspect(aspect);
  const found = findTrack(trackQuery, d);

  const base = {
    banner: d.banner,
    royalty_path: d.royalty_path,
    contact: d.contact,
    global_gaps: d.global_gaps,
    aspect: asp,
    aspect_label: ASPECT_LABELS[asp],
  };

  if (found.status === 'empty') {
    return Object.assign({}, base, {
      verdict: 'insufficient-data',
      title: 'No track entered',
      facts: [],
      unknown: ['Enter a track title to see what CWI can verify about who gets paid on it.'],
      note: 'Type a track name above, or pick one from the list.',
    });
  }

  if (found.status === 'suggest') {
    return Object.assign({}, base, {
      verdict: 'insufficient-data',
      title: 'Track not matched',
      facts: [],
      unknown: [
        'We could not match that title exactly. Did you mean "' +
          found.track.title +
          '"? Please enter the exact title — we never guess which track you mean when money is involved.',
      ],
      note: null,
    });
  }

  if (found.status === 'unknown') {
    return Object.assign({}, base, {
      verdict: 'insufficient-data',
      title: 'Insufficient data — not in our records',
      facts: [],
      unknown: [
        'This title is not in CWI\u2019s rights records, so nothing about its writers, splits, PRO affiliation, or publisher can be verified here.',
        'If this is a CWI track, contact Business Affairs and they will check the underlying records directly.',
      ],
      note: null,
    });
  }

  const t = found.track;
  const facts = filterByAspect(t.facts || [], asp);
  const unknown = asp === 'master'
    ? [
        'Writer/publishing splits (publishing side): UNVERIFIED — splits not cleared by the rights holder. No signed split sheets on file.',
        'Verified master-rights holders: Black\u2019s statement is on record but no chain-of-title documentation exists to independently verify it.',
        'Sample attestation: no clearance letters and no sworn no-sample statement on file.',
      ]
    : asp === 'publishing'
      ? [
          'Split percentages: UNVERIFIED — splits not cleared by the rights holder. No signed split sheets on file.',
          'PRO affiliation: unknown — no publisher ID or work registration numbers on file.',
          'Publisher: not on record — no publisher can be named.',
        ]
      : [
          'Split percentages: UNVERIFIED — splits not cleared by the rights holder. No signed split sheets on file.',
          'Verified rights holders: cannot be confirmed from CWI\u2019s records.',
          'PRO affiliation: unknown — no publisher or work registration numbers on file.',
          'Sample attestation: no clearance letters and no sworn no-sample statement on file.',
        ];

  return Object.assign({}, base, {
    verdict: 'info-ready',
    title: t.title,
    facts: facts,
    unknown: unknown,
    spotify_track_id: t.spotify_track_id || null,
    note: 'Production credits are not rights-holder records. Only the facts above carry a verifiable evidence tier; everything else needs Business Affairs.',
  });
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { check, findTrack, normalize, validAspect, loadData, ASPECTS, ASPECT_LABELS };
}
