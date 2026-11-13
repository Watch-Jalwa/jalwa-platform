/**
 * Editorial thumbnails supplied for the governed launch catalogue.
 * Keys are catalogue slugs; unmatched items keep their existing thumbnails.
 */
export const PROVIDED_CATALOGUE_THUMBNAILS = Object.freeze({
  "artemis-ii-lunar-flyby-svs": "/catalogue/thumbnails/artemis-ii-lunar-flyby-svs.jpeg",
  "artemis-ii-trajectory-svs": "/catalogue/thumbnails/artemis-ii-trajectory-svs.jpeg",
  "hd-earth-views-svs": "/catalogue/thumbnails/hd-earth-views-svs.jpeg",
  "hst-fly-by-nasa": "/catalogue/thumbnails/hst-fly-by-nasa.jpeg",
  "hst-sm4-rendezvous-nasa": "/catalogue/thumbnails/hst-sm4-rendezvous-nasa.jpeg",
  "earth-views-from-iss-nasa": "/catalogue/thumbnails/earth-views-from-iss-nasa.jpeg",
  "grca-south-rim-summer-timelapse": "/catalogue/thumbnails/grca-south-rim-summer-timelapse.jpeg",
  "grca-animals-broll": "/catalogue/thumbnails/grca-animals-broll.jpeg",
  "grca-south-rim-winter-scenic": "/catalogue/thumbnails/grca-south-rim-winter-scenic.jpeg",
  "spring-blender": "/catalogue/thumbnails/spring-blender.jpeg",
  "caminandes-llamigos": "/catalogue/thumbnails/caminandes-llamigos.jpeg",
  "apollo-11-eagle-has-landed": "/catalogue/thumbnails/apollo-11-eagle-has-landed.jpeg",
  "sprite-fright": "/catalogue/thumbnails/sprite-fright.jpeg",
  "cosmos-laundromat": "/catalogue/thumbnails/cosmos-laundromat.jpeg",
  "vhs-static-cc0-clip": "/catalogue/thumbnails/vhs-static-cc0-clip.jpeg",
  sintel: "/catalogue/thumbnails/sintel.jpeg",
  "counting-chisenbop-cc0": "/catalogue/thumbnails/counting-chisenbop-cc0.jpeg",
  "how-fossils-form-cc-by": "/catalogue/thumbnails/how-fossils-form-cc-by.jpeg",
  "vanellus-vanellus-cc0": "/catalogue/thumbnails/vanellus-vanellus-cc0.jpeg",
  "ocean-surface-waves-cc0": "/catalogue/thumbnails/ocean-surface-waves-cc0.jpeg",
  "proxima-centauri-flythrough-cc-by": "/catalogue/thumbnails/proxima-centauri-flythrough-cc-by.jpeg",
  "tiny-waterfall-cc0": "/catalogue/thumbnails/tiny-waterfall-cc0.jpeg",
  "tree-trimmer-cc0": "/catalogue/thumbnails/tree-trimmer-cc0.jpeg",
  "tears-of-steel": "/catalogue/thumbnails/tears-of-steel.jpeg",
  "promise-of-pakistan-geography": "/catalogue/thumbnails/promise-of-pakistan-geography.jpeg",
  "invitation-to-pakistan-nara": "/catalogue/thumbnails/invitation-to-pakistan-nara.jpeg",
  "wikipedia-science-comms-cc-by": "/catalogue/thumbnails/harnessing-wikipedia-science-communication.png",
  "eso-cast-265-light": "/catalogue/thumbnails/eso-cast-265-light.jpeg",
  "eso-cast-254-light": "/catalogue/thumbnails/eso-cast-254-light.jpeg",
  "elephants-dream": "/catalogue/thumbnails/elephants-dream.jpeg",
  "big-buck-bunny": "/catalogue/thumbnails/big-buck-bunny.jpeg",
  "baking-cookies-cc0": "/catalogue/thumbnails/baking-cookies-cc0.jpeg",
});

export function providedCatalogueThumbnailForSlug(slug) {
  if (typeof slug !== "string" || !slug) return null;
  return PROVIDED_CATALOGUE_THUMBNAILS[slug] ?? null;
}
