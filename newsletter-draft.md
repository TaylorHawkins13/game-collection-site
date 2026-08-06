# Shelf Life newsletter draft — for /admin/newsletter

Shorter version with screenshots, per your feedback. How to send:

1. Push the latest commits first — the images live at `shelflife.site/newsletter/*.jpg`
   (in `public/newsletter/`), so they need to actually be deployed before this goes out or
   the images will just be broken in the email.
2. On `/admin/newsletter`: paste the subject below into Subject, paste the HTML block below
   into Body, tick **"This body is HTML"** (a live preview appears once you do), tick
   **"Send to everyone, not just opted-in"**, then Review & send.

Screenshots: dashboard, add-item search, the card grid, activity feed, the series
completion view (the one you sent over), and the shelf mosaic. The old leaderboard
screenshot got swapped out — it was sitting under the "See full series" paragraph, which
didn't match what it showed. Let me know if you'd rather swap any of these for something
else.

---

## Subject

Everything that's shipped on Shelf Life (and what's next)

---

## Body (HTML — paste as-is, tick "This body is HTML")

```html
<div style="max-width:600px;margin:0 auto;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1c2138;line-height:1.5;">
  <h1 style="font-size:22px;margin:0 0 6px;">Shelf Life: everything that's shipped</h1>
  <p style="margin:0 0 20px;color:#5c6491;font-size:14px;">A quick look at how far it's come since you signed up.</p>

  <img src="https://shelflife.site/newsletter/dashboard.jpg" alt="Shelf Life dashboard" style="width:100%;border-radius:8px;border:1px solid #e2e2e2;display:block;">
  <p style="margin:10px 0 24px;font-size:14px;">
    <strong>10 collectible types now</strong> — games, comics, trading cards, vinyl, books,
    DVDs, VHS, CDs, consoles, Funko Pops — each with its own fields instead of one generic form.
  </p>

  <img src="https://shelflife.site/newsletter/search.jpg" alt="Search auto-fill" style="width:100%;border-radius:8px;border:1px solid #e2e2e2;display:block;">
  <p style="margin:10px 0 24px;font-size:14px;">
    <strong>Adding is fast now</strong> — search auto-fills cover art and details for most
    types, or scan a barcode. Steam import and CSV import handle bulk adds.
  </p>

  <img src="https://shelflife.site/newsletter/cards.jpg" alt="Item card grid" style="width:100%;border-radius:8px;border:1px solid #e2e2e2;display:block;">
  <p style="margin:10px 0 24px;font-size:14px;">
    <strong>Real market values</strong> — check current eBay prices per item and track your
    whole collection's value over time.
  </p>

  <img src="https://shelflife.site/newsletter/feed.jpg" alt="Activity feed" style="width:100%;border-radius:8px;border:1px solid #e2e2e2;display:block;">
  <p style="margin:10px 0 24px;font-size:14px;">
    <strong>It's social</strong> — follow other collectors, see their activity, react and
    comment. Trophies, levels, and a leaderboard reward real milestones.
  </p>

  <img src="https://shelflife.site/newsletter/series.jpg" alt="Series completion view" style="width:100%;border-radius:8px;border:1px solid #e2e2e2;display:block;">
  <p style="margin:10px 0 24px;font-size:14px;">
    <strong>NEW:</strong> tap any game, comic, trading card, or Funko Pop and hit
    "See full series" to see the whole set, with what you're missing greyed out.
  </p>

  <img src="https://shelflife.site/newsletter/mosaic.jpg" alt="Shelf mosaic" style="width:100%;border-radius:8px;border:1px solid #e2e2e2;display:block;">
  <p style="margin:10px 0 24px;font-size:14px;">
    <strong>The shelf mosaic</strong> — your whole collection as real cover art, arranged
    like a shelf. Downloadable and shareable.
  </p>

  <p style="margin:0 0 16px;font-size:14px;">
    It's also installable to your phone's home screen — and a real iOS App Store version is
    currently sitting in Apple's review queue. No confirmed date yet, but it's close. You'll
    hear about it here the moment it's live.
  </p>

  <p style="margin:0 0 24px;font-size:14px;">Thanks for being here early.<br>— Taylor</p>

  <p style="margin:0;font-size:11px;color:#9aa1c4;">
    You're getting this because you have a Shelf Life account. Future updates like this go
    through "Email me when something new ships" in Profile Settings.
  </p>
</div>
```
