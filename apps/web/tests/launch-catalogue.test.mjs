import assert from "node:assert/strict";
import test from "node:test";
import { validateLaunchCatalogue } from "../../../scripts/launch-catalogue.mjs";

const validItem = {
  slug: "useful-learning-video",
  contentType: "video",
  hostingMode: "embed_only",
  accessLevel: "public",
  titleEn: "Useful learning video",
  titleUr: "مفید تعلیمی ویڈیو",
  titleRomanUr: "Mufeed taleemi video",
  descriptionEn: "A sufficiently detailed description for a reviewed catalogue item.",
  categorySlug: "learn",
  language: "multi",
  durationSeconds: 120,
  audience: "general",
  sensitivity: "standard",
  source: { provider: "youtube", providerContentId: "dQw4w9WgXcQ", embedUrl: "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ", externalUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" },
  rights: { sourceUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", creator: "Example creator", licenceCode: "provider-embed-terms", attributionText: "Embedded with the official provider player.", evidenceReference: "rights/evidence.pdf", embeddingConfirmed: true, selfHostingConfirmed: false, commercialUseConfirmed: false, modificationConfirmed: false, reviewedByAi: false },
};

test("accepts a rights-complete embed record", () => {
  const result = validateLaunchCatalogue([validItem]);
  assert.equal(result.ok, true);
  assert.equal(result.summary.items, 1);
});

test("rejects AI rights approval and unsafe YouTube embeds", () => {
  const result = validateLaunchCatalogue([{ ...validItem, source: { ...validItem.source, embedUrl: "https://youtube.com/embed/dQw4w9WgXcQ" }, rights: { ...validItem.rights, reviewedByAi: true } }]);
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /youtube-nocookie/);
  assert.match(result.errors.join("\n"), /AI cannot approve rights/);
});

test("requires confirmed self-hosting and commercial rights for open media", () => {
  const result = validateLaunchCatalogue([{ ...validItem, hostingMode: "self_host_open", source: { provider: "blender", providerContentId: "asset-1", externalUrl: "https://studio.blender.org/films/" }, rights: { ...validItem.rights, embeddingConfirmed: false, selfHostingConfirmed: false, commercialUseConfirmed: false } }]);
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /self-hosting rights/);
  assert.match(result.errors.join("\n"), /commercialUseConfirmed/);
});
