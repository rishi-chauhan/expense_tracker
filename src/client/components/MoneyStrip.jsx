import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import Amount from './ui/Amount';
import { useSettings } from '../contexts/SettingsContext';
import { formatINR } from '../utils/dataProcessing.js';
import './MoneyStrip.css';

const MIN_SEGMENT_PCT = 2.5;
const UNCATEGORISED = '#8b90a0';

/**
 * The Overview's answer to "where did the money go?": the period total as a
 * sentence, then one bar split into categories (each segment links to those
 * transactions). Small categories fold into a neutral "Other" segment.
 */
export default function MoneyStrip({ total, rangeLabel, categories, linkFor }) {
  const { hideAmounts } = useSettings();

  const segments = useMemo(() => {
    if (!total) return [];
    const big = [];
    let small = 0;
    let smallCount = 0;
    for (const c of categories) {
      const pct = (c.total / total) * 100;
      if (pct >= MIN_SEGMENT_PCT) big.push({ ...c, pct });
      else { small += c.total; smallCount += 1; }
    }
    if (small > 0) {
      big.push({ name: `${smallCount} smaller categor${smallCount === 1 ? 'y' : 'ies'}`, total: small, pct: (small / total) * 100, color: null, other: true });
    }
    return big;
  }, [categories, total]);

  const top = segments.filter(s => !s.other).slice(0, 3);

  return (
    <section className="money-strip" aria-labelledby="money-strip-heading">
      <h2 id="money-strip-heading" className="money-headline">
        <Amount value={total} whole className="money-total" />
        <span className="money-phrase"> went out {rangeLabel}</span>
      </h2>

      {segments.length > 0 && (
        <>
          <ol className="strip" aria-label="Spending by category">
            {segments.map(seg => {
              const label = `${seg.name}: ${hideAmounts ? 'amount hidden' : formatINR(seg.total)}, ${Math.round(seg.pct)}%`;
              const style = { flexGrow: seg.pct, background: seg.color || (seg.other ? 'var(--border)' : UNCATEGORISED) };
              return (
                <li key={seg.name} className={`strip-seg${seg.other ? ' is-other' : ''}`} style={style}>
                  {seg.other ? (
                    <span className="strip-hit" title={label} aria-label={label} role="img" />
                  ) : (
                    <Link className="strip-hit" to={linkFor(seg)} title={label} aria-label={label} />
                  )}
                </li>
              );
            })}
          </ol>
          <p className="strip-legend">
            {top.map(seg => (
              <Link key={seg.name} to={linkFor(seg)} className="strip-legend-item">
                <span className="strip-dot" style={{ background: seg.color || UNCATEGORISED }} aria-hidden="true" />
                <span className="strip-legend-name">{seg.name}</span>
                <span className="strip-legend-pct num">{Math.round(seg.pct)}%</span>
              </Link>
            ))}
          </p>
        </>
      )}
    </section>
  );
}
