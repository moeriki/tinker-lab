// Shown when someone scans a slug the inventory does not contain: a QR from a parcel, a poster,
// a neighbour's wifi card, or one of ours with a digit rubbed off. It is a dead end, not an
// error, so it says so in the party's voice rather than shouting 404 -- but the response really
// is a 404, because the code really does not exist.
//
// It deliberately does not offer to search, guess or "did you mean". A near-miss slug belongs to
// a real code somewhere in the house, and handing it over would turn a rubbed-off card into a
// free unlock.

export default {
  id: 'no-such-code',
  title: 'That one is not ours',
  // The two paragraphs sit on a `.paper` sheet (#105) -- two or more paragraphs the page exists to
  // have read get one, and this page is nothing but the read. It is also the page most likely to be
  // met in bad light with a phone at arm's length, which is the case the sheet was drawn for. The
  // `<small>` sign-off stays outside it: it is an aside, not part of the passage.
  body: `
    <div class="paper">
      <p>You scanned something. It was not one of ours.</p>
      <p>
        Every code in this house has a coloured stripe and says <strong>bday.moeriki.com</strong>
        across the top. This one didn't, or it did and the paper has had a hard night.
      </p>
    </div>
    <p><small>Keep looking. The real ones are hiding better than this.</small></p>
  `,
  showClose: true,
};
