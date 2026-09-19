'use client';

import { useState } from 'react';
import useModalA11y from '@/lib/useModalA11y';
import useSeriesLookup from '@/lib/useSeriesLookup';
import { seriesSupported, isMasterSetType, seriesQueryValueFor, ownedKeysFor, prefillFromSeriesEntry, variantHintsFor } from '@/lib/seriesLookup';
import { goToBestListing } from '@/lib/externalListings';
import SeriesGrid from './SeriesGrid';
import { getStatRows } from './GameCard';
import { currencySymbol } from '@/lib/currency';
import CategoryIcon from './CategoryIcon';

function cap(s) {
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Read-only "view" state for a card — the default click target for both
// your own dashboard grid (see ROADMAP.md "Collection/profile cards": "a
// real view/detail state as the default click target with Edit as its
// own separate, explicit action instead") and, since Sep 2026, every
// public profile's collection/Showcase grids too (`ProfileTabs.jsx`,
// `ShowcaseSection.jsx` — see CHANGELOG.md: those used to jump straight
// into the series-only `SeriesModal` on tap, which is the wrong default
// for the same reason skipping straight to Edit was wrong on the
// dashboard — you lose the card itself). Shows the same stat rows the
// card itself does (via GameCard's exported getStatRows, so the two never
// drift apart), plus the handful of fields that only ever lived inside
// the edit form before this — notes, purchase price/date, variant
// details, condition photos — since those are exactly the kind of thing
// worth a quick look without committing to editing anything.
//
// Also carries its own "See full series" toggle, same as GameModal's —
// requested directly: checking series completion from the card you
// clicked was buried behind Edit, when it's a read-only look that has
// nothing to do with editing anything. `existingItems` is whichever
// collection this card lives in — your own on the dashboard, or
// whichever profile's collection is being viewed elsewhere — used to
// compute series completion against. `isOwnProfile` (defaults to `true`,
// matching the dashboard's own always-your-own-collection assumption)
// gates whether a missing series entry is clickable: only makes sense
// when `existingItems` really is the viewer's own collection, same
// reasoning `SeriesModal` already applies — on someone else's profile,
// "missing from their collection" says nothing about whether the viewer
// already has it. When it is actionable, clicking a missing entry
// navigates to a real listing (see lib/externalListings.js — eBay if it
// has any, CeX otherwise) rather than routing through this app's own Add
// Item form first — reported back directly that the extra form click
// wasn't wanted, just the listing itself. `onEdit`, when passed, adds an
// Edit button that hands the game off to the real edit form — omitted
// entirely on a public profile, since there's nothing to edit there even
// on your own profile (that's what the dashboard is for).
export default function ItemDetailModal({ game, currency, existingItems, onClose, onEdit, isOwnProfile = true, ownerLabel }) {
  const modalRef = useModalA11y(onClose);
  const series = useSeriesLookup();
  const [coverFailed, setCoverFailed] = useState(false);
  const statRows = getStatRows(game, currency);
  const isComic = game.item_type === 'comic';
  const isCard = game.item_type === 'trading_card';
  const isFunko = game.item_type === 'funko_pop';
  const hasVariant = (isComic || isCard || isFunko) && game.is_variant;
  const priceCurrency = game.market_price_currency || currency || 'USD';
  const seriesValue = seriesQueryValueFor(game);
  const ownedKeys = ownedKeysFor(existingItems, game.item_type);

  function handleSelectMissing(entry) {
    const prefill = prefillFromSeriesEntry(game.item_type, series.data.seriesName, entry);
    goToBestListing(prefill, currency);
  }

  return (
    <div className="overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" ref={modalRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="detail-modal-title">
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
          <h2 id="detail-modal-title" style={{ margin: 0 }}>{game.title}</h2>
          <button type="button" className="btn-ghost" style={{ flexShrink: 0 }} onClick={onClose}>
            Close
          </button>
        </div>
        <div className="sub" style={{ textTransform: 'capitalize' }}>
          {game.ownership} · {(game.item_type || '').replace('_', ' ')}
        </div>

        {(series.loading || series.error || series.data) && (
          <div className="field">
            {series.loading && <div className="sub" style={{ marginTop: 0 }}>Looking up the series…</div>}
            {series.error && <div className="sub" style={{ marginTop: 0 }}>{series.error}</div>}
            {series.data && (
              <SeriesGrid
                data={series.data}
                ownedKeys={ownedKeys}
                ownerLabel={isOwnProfile ? null : ownerLabel}
                onSelectMissing={isOwnProfile ? handleSelectMissing : undefined}
              />
            )}
          </div>
        )}

        <div className="detail-layout">
          <div className="detail-cover-wrap">
            {game.cover && !coverFailed ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                className="detail-cover"
                src={game.cover}
                alt={game.title}
                onError={() => setCoverFailed(true)}
              />
            ) : (
              <div className="detail-cover placeholder">
                <CategoryIcon type={game.item_type} size={34} className="cover-placeholder-icon" />
                <span className="cover-placeholder-label">No Cover</span>
              </div>
            )}
          </div>
          <div className="stat-rows detail-stat-rows">
            {statRows.map((row) => (
              <div className={`stat-row${row.className ? ` ${row.className}` : ''}`} key={row.label}>
                <span className="stat-label" title={row.label}>{row.label}</span>
                <span className="stat-value">{row.value}</span>
              </div>
            ))}
          </div>
        </div>

        {(hasVariant || game.copy_type || game.fully_completed || game.showcase_order != null || (game.tags || []).length > 0) && (
          <div className="badge-row" style={{ marginTop: 10 }}>
            {hasVariant && <span className="badge tag">{isFunko ? 'Chase' : isCard ? 'Parallel' : 'Variant'}</span>}
            {game.copy_type && <span className={`badge tag copy-${game.copy_type}`}>{cap(game.copy_type)}</span>}
            {game.fully_completed && <span className="badge tag complete-100">100% Complete</span>}
            {game.showcase_order != null && <span className="badge tag showcase-badge">Showcased</span>}
            {(game.tags || []).map((t) => (
              <span className="badge tag" key={t}>{t}</span>
            ))}
          </div>
        )}

        {hasVariant && game.variant_notes && (
          <div className="field">
            <label>Variant details</label>
            <p className="sub" style={{ margin: 0 }}>{game.variant_notes}</p>
          </div>
        )}

        {(game.price != null || game.purchase_date) && (
          <div className="field">
            <label>Purchase</label>
            <p className="sub" style={{ margin: 0 }}>
              {game.price != null ? `${currencySymbol(priceCurrency)}${game.price}` : 'Price not recorded'}
              {game.purchase_date ? ` · ${new Date(game.purchase_date).toLocaleDateString()}` : ''}
            </p>
          </div>
        )}

        {game.notes && (
          <div className="field">
            <label>Notes</label>
            <p className="sub" style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{game.notes}</p>
          </div>
        )}

        {game.condition_photos?.length > 0 && (
          <div className="field">
            <label>Condition photos</label>
            <div className="condition-photos-grid">
              {game.condition_photos.map((url, i) => (
                <div className="condition-photo" key={url}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt={`Condition photo ${i + 1}`} />
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="modal-actions">
          <span />
          <div className="right">
            {seriesSupported(game.item_type) && (
              <button
                type="button"
                className="btn-ghost"
                onClick={() =>
                  series.data
                    ? series.reset()
                    : series.load(
                        game.item_type,
                        seriesValue,
                        game.item_type === 'trading_card' ? variantHintsFor(existingItems, game.card_set) : undefined
                      )
                }
                disabled={series.loading}
              >
                {series.loading
                  ? 'Loading…'
                  : series.data
                    ? (isMasterSetType(game.item_type) ? 'Hide master set' : 'Hide series')
                    : (isMasterSetType(game.item_type) ? 'See master set' : 'See full series')}
              </button>
            )}
            {onEdit && (
              <button type="button" className="btn-primary" onClick={() => onEdit(game)}>
                Edit
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
