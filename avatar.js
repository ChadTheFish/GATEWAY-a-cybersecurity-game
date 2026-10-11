/* Placeholder pixel portraits. Replaced by `image` / `photoImage` in data.js when you add real art. */
function pixelAvatar(look) {
  const L = Object.assign(
    { skin: "#f6d2b5", hair: "#5a3a2a", hairStyle: "short", shirt: "#5a8de0", eyes: "#2b2d5c", accessory: "none" },
    look
  );
  const out = [];
  const r = (x, y, w, h, c) => out.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${c}"/>`);

  // long hair sits behind the head
  if (L.hairStyle === "long") { r(3, 5, 2, 10, L.hair); r(11, 5, 2, 10, L.hair); }
  if (L.hairStyle === "afro") { r(2, 1, 12, 9, L.hair); }

  r(2, 15, 12, 3, L.shirt);           // shoulders
  r(3, 14, 10, 1, L.shirt);
  r(6, 13, 4, 2, L.skin);              // neck
  r(3, 8, 1, 2, L.skin); r(12, 8, 1, 2, L.skin); // ears
  r(4, 5, 8, 8, L.skin);               // head
  r(5, 4, 6, 1, L.skin);

  r(6, 8, 1, 2, L.eyes); r(9, 8, 1, 2, L.eyes); // eyes
  r(5, 10, 1, 1, "#f49a9a"); r(10, 10, 1, 1, "#f49a9a"); // blush
  r(7, 11, 2, 1, "#a8554a");           // mouth

  switch (L.hairStyle) {
    case "buzz": r(4, 4, 8, 1, L.hair); r(5, 3, 6, 1, L.hair); break;
    case "spiky": r(4, 3, 8, 3, L.hair); r(4, 6, 1, 2, L.hair); r(11, 6, 1, 2, L.hair);
      r(4, 2, 1, 1, L.hair); r(6, 1, 1, 2, L.hair); r(8, 2, 1, 1, L.hair); r(10, 1, 1, 2, L.hair); r(12, 3, 1, 2, L.hair); break;
    case "bun": r(4, 3, 8, 2, L.hair); r(4, 5, 1, 2, L.hair); r(11, 5, 1, 2, L.hair); r(6, 0, 4, 3, L.hair); break;
    case "afro": r(4, 4, 8, 1, L.hair); break;
    default: r(4, 3, 8, 2, L.hair); r(4, 5, 2, 1, L.hair); r(4, 5, 1, 3, L.hair); r(11, 5, 1, 3, L.hair);
  }

  if (L.accessory === "glasses") { r(5, 7, 3, 1, "#2b2d5c"); r(8, 7, 3, 1, "#2b2d5c"); r(5, 8, 1, 2, "#2b2d5c"); r(10, 8, 1, 2, "#2b2d5c"); }
  if (L.accessory === "visor") { r(4, 8, 8, 1, "#5ad1ff"); r(4, 7, 8, 1, "#2b2d5c"); }

  return `<svg viewBox="0 0 16 18" shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg">${out.join("")}</svg>`;
}
