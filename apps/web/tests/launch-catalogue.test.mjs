import assert from "node:assert/strict";
import test from "node:test";
import { parseCatalogueCsv, validateLaunchCatalogue } from "../../../scripts/launch-catalogue.mjs";

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
  rights: { sourceUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", creator: "Example creator", licenceCode: "provider-embed-terms", attributionText: "Embedded with the official provider player.", evidenceReference: "rights/evidence.pdf", takedownContact: "rights@example.org", embeddingConfirmed: true, selfHostingConfirmed: false, commercialUseConfirmed: false, modificationConfirmed: false, reviewedByAi: false },
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

test("requires confirmed self-hosting and commercial rights for self-hosted media", () => {
  const result = validateLaunchCatalogue([{ ...validItem, hostingMode: "self_host_open", source: { provider: "blender", providerContentId: "asset-1", externalUrl: "https://studio.blender.org/films/" }, rights: { ...validItem.rights, embeddingConfirmed: false, selfHostingConfirmed: false, commercialUseConfirmed: false } }]);
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /self-hosting rights/);
  assert.match(result.errors.join("\n"), /commercialUseConfirmed/);
});

test("requires takedown ownership and rejects expired rights", () => {
  const result = validateLaunchCatalogue([{ ...validItem, rights: { ...validItem.rights, takedownContact: "", expiresAt: "2020-01-01T00:00:00Z" } }]);
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /takedownContact/);
  assert.match(result.errors.join("\n"), /already expired/);
});

test("rejects duplicate source URLs in one launch batch", () => {
  const result = validateLaunchCatalogue([validItem, { ...validItem, slug: "second-video", source: { ...validItem.source, providerContentId: "M7lc1UVf-VE" } }]);
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /duplicate source URL/);
});

test("parses quoted CSV fields into the governed catalogue shape", () => {
  const csv = [
    "slug,contentType,hostingMode,accessLevel,titleEn,titleUr,titleRomanUr,descriptionEn,categorySlug,language,durationSeconds,audience,sensitivity,source.provider,source.providerContentId,source.embedUrl,source.externalUrl,rights.sourceUrl,rights.creator,rights.licenceCode,rights.attributionText,rights.evidenceReference,rights.takedownContact,rights.embeddingConfirmed,rights.selfHostingConfirmed,rights.commercialUseConfirmed,rights.modificationConfirmed",
    "csv-video,video,embed_only,public,CSV video,سی ایس وی ویڈیو,CSV video,\"A detailed description, including a comma for parser coverage.\",learn,multi,90,general,standard,youtube,dQw4w9WgXcQ,https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ,https://www.youtube.com/watch?v=dQw4w9WgXcQ,https://www.youtube.com/watch?v=dQw4w9WgXcQ,Example creator,provider-embed-terms,Official provider attribution.,rights/evidence.pdf,rights@example.org,true,false,false,false",
  ].join("\n");
  const [item] = parseCatalogueCsv(csv);
  assert.equal(item.descriptionEn, "A detailed description, including a comma for parser coverage.");
  assert.equal(item.rights.embeddingConfirmed, true);
  assert.equal(validateLaunchCatalogue([item]).ok, true);
});
