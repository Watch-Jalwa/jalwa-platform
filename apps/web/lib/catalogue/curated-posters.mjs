/**
 * Rights-cleared, content-relevant poster art for known open-catalogue titles.
 * Prefer official CC / public-domain stills over generic generated cards.
 */
export const CURATED_CATALOGUE_POSTERS = Object.freeze({
  sintel: "https://upload.wikimedia.org/wikipedia/commons/8/8f/Sintel_poster.jpg",
  "cosmos-laundromat": "https://upload.wikimedia.org/wikipedia/commons/c/c5/CosmosLaundromatPoster.jpg",
  "sprite-fright": "https://upload.wikimedia.org/wikipedia/commons/e/e5/Sprite_Fright-movie_poster.jpg",
  "spring-blender": "https://upload.wikimedia.org/wikipedia/commons/2/25/Spring2019AlphaPosterBlender.jpg",
  "caminandes-llamigos":
    "https://upload.wikimedia.org/wikipedia/commons/a/aa/Blender_Foundation_-_Caminandes_-_Episode_3_-_Llamigos_-_Cover_thumbnail.png",
  "big-buck-bunny": "https://upload.wikimedia.org/wikipedia/commons/c/c5/Big_buck_bunny_poster_big.jpg",
  "big-buck-bunny-open-movie": "https://upload.wikimedia.org/wikipedia/commons/c/c5/Big_buck_bunny_poster_big.jpg",
  "elephants-dream": "https://upload.wikimedia.org/wikipedia/commons/0/0c/ElephantsDreamPoster.jpg",
  "tears-of-steel": "https://upload.wikimedia.org/wikipedia/commons/7/70/Tos-poster.png",
  "apollo-11-eagle-has-landed": "https://images-assets.nasa.gov/image/as11-40-5874/as11-40-5874~medium.jpg",
  "earth-views-from-iss-nasa": "https://images-assets.nasa.gov/image/iss040e081022/iss040e081022~medium.jpg",
  "grca-south-rim-winter-scenic":
    "https://upload.wikimedia.org/wikipedia/commons/f/fb/Sunrise_from_Grand_Canyon_Village_-_8349_%2855121088440%29.jpg",
  "grca-south-rim-summer-timelapse":
    "https://upload.wikimedia.org/wikipedia/commons/0/01/Grand_Canyon_Powell_Point_Evening_Light_02_2013.jpg",
  "grca-animals-broll": "https://upload.wikimedia.org/wikipedia/commons/f/f2/Grand_canyon_march_2013.jpg",
});

export function curatedPosterUrlForSlug(slug) {
  if (typeof slug !== "string" || !slug) return null;
  return CURATED_CATALOGUE_POSTERS[slug] ?? null;
}
