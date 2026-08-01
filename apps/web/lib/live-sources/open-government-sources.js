import { LIVE_SOURCE_REGISTRY } from "./registry";

const HOSTS = {
  dvids: ["www.dvidshub.net", "dvidshub.net"],
  nasa: ["www.nasa.gov", "nasa.gov", "plus.nasa.gov"],
  nps: ["www.nps.gov", "home.nps.gov"],
  nih: ["videocast.nih.gov", "www.nih.gov", "nih.gov", "www.nlm.nih.gov", "nlm.nih.gov"],
  fda: ["www.fda.gov", "fda.gov"],
  sec: ["www.sec.gov", "sec.gov"],
  fcc: ["www.fcc.gov", "fcc.gov"],
  eu: ["audiovisual.ec.europa.eu", "ec.europa.eu", "commission.europa.eu"],
  house: ["live.house.gov", "www.house.gov", "house.gov"],
  senate: ["www.senate.gov", "senate.gov"],
};

function officialLink([key, title, titleUrdu, description, provider, url, terms, attribution, hosts]) {
  return [key, {
    key,
    slug: key,
    title,
    titleUrdu,
    description,
    provider,
    adapter: "official_live_link",
    officialSourceUrl: url,
    termsUrl: terms,
    attribution,
    allowedHosts: hosts,
    refreshIntervalSeconds: 900,
    freshnessThresholdSeconds: 86400,
    offAirAllowed: true,
  }];
}

function npsCamera([key, title, titleUrdu, description, id]) {
  const pageUrl = `https://www.nps.gov/media/webcam/view.htm?id=${id}`;
  return [key, {
    key,
    slug: key,
    title,
    titleUrdu,
    description,
    provider: "nps",
    adapter: "public_domain_live_image",
    officialSourceUrl: pageUrl,
    termsUrl: "https://www.nps.gov/aboutus/disclaimer.htm",
    attribution: "Source: National Park Service. No claim to original U.S. Government works. NPS does not endorse Jalwa.",
    allowedHosts: HOSTS.nps,
    imageUrl: pageUrl,
    imagePathPattern: "^/webcams-[a-z0-9-]+/[^?#]+\\.(?:jpe?g|png|webp|gif)$",
    refreshIntervalSeconds: 300,
    freshnessThresholdSeconds: 7200,
  }];
}

const DVIDS_TERMS = "https://www.dvidshub.net/about/copyright";
const DVIDS_ATTRIBUTION = "Source: Defense Visual Information Distribution Service. No endorsement of Jalwa is implied.";
const NASA_TERMS = "https://www.nasa.gov/nasa-brand-center/images-and-media/";
const NASA_ATTRIBUTION = "Source: NASA. NASA does not endorse Jalwa or its advertisers.";

const linkRows = [
  ["dvids-live-webcasts", "DVIDS Live Webcasts", "ڈی وی آئی ڈی ایس براہ راست نشریات", "Upcoming official U.S. Department of Defense public-affairs webcasts. Individual events remain subject to their displayed rights metadata.", "dvids", "https://www.dvidshub.net/webcast", DVIDS_TERMS, DVIDS_ATTRIBUTION, HOSTS.dvids],
  ["dvids-pentagon-press-briefings", "Pentagon Press Briefings", "پینٹاگون پریس بریفنگز", "Official Pentagon press-briefing coverage published through DVIDS.", "dvids", "https://www.dvidshub.net/feature/PentagonPressBriefings", DVIDS_TERMS, DVIDS_ATTRIBUTION, HOSTS.dvids],
  ["dvids-white-house-public-events", "White House Public Events via DVIDS", "وائٹ ہاؤس عوامی تقریبات بذریعہ ڈی وی آئی ڈی ایس", "Official public events made available through the DVIDS webcast catalogue.", "dvids", "https://www.dvidshub.net/webcast", DVIDS_TERMS, DVIDS_ATTRIBUTION, HOSTS.dvids],
  ["dvids-navy-recruit-graduations", "U.S. Navy Recruit Training Graduations", "امریکی بحریہ ریکروٹ ٹریننگ گریجویشن", "Official recruit-training graduation webcasts listed by DVIDS.", "dvids", "https://www.dvidshub.net/webcast", DVIDS_TERMS, DVIDS_ATTRIBUTION, HOSTS.dvids],
  ["dvids-defense-conferences-ceremonies", "Defense Conferences and Ceremonies", "دفاعی کانفرنسیں اور تقریبات", "Official defense conferences, ceremonies and public-affairs events listed by DVIDS.", "dvids", "https://www.dvidshub.net/webcast", DVIDS_TERMS, DVIDS_ATTRIBUTION, HOSTS.dvids],
  ["nasa-plus-live-events", "NASA+ Live Events", "ناسا پلس براہ راست تقریبات", "Official NASA+ live and upcoming event schedule.", "nasa", "https://plus.nasa.gov/scheduled-events/", NASA_TERMS, NASA_ATTRIBUTION, HOSTS.nasa],
  ["nasa-mission-launch-coverage", "NASA Mission and Launch Coverage", "ناسا مشن اور لانچ کوریج", "Official NASA mission, launch and agency-event coverage.", "nasa", "https://www.nasa.gov/live/", NASA_TERMS, NASA_ATTRIBUTION, HOSTS.nasa],
  ["nasa-space-to-ground", "NASA Space-to-Ground", "ناسا اسپیس ٹو گراؤنڈ", "Official NASA space-station news, mission audio and scheduled coverage.", "nasa", "https://plus.nasa.gov/topics/news-events/", NASA_TERMS, NASA_ATTRIBUTION, HOSTS.nasa],
  ["nih-videocast", "NIH VideoCast", "این آئی ایچ ویڈیو کاسٹ", "Official National Institutes of Health live scientific events. Inline use remains event-specific because guest material may retain copyright.", "nih", "https://videocast.nih.gov/", "https://www.nlm.nih.gov/web_policies.html", "Source: National Institutes of Health. NIH does not endorse Jalwa.", HOSTS.nih],
  ["fda-advisory-committee-live", "FDA Advisory Committee Live", "ایف ڈی اے مشاورتی کمیٹی براہ راست", "Official U.S. Food and Drug Administration advisory-committee calendar and webcast access.", "fda", "https://www.fda.gov/advisory-committees/advisory-committee-calendar", "https://www.fda.gov/about-fda/about-website/website-policies", "Source: U.S. Food and Drug Administration. FDA does not endorse Jalwa.", HOSTS.fda],
  ["sec-public-meetings", "SEC Public Meetings", "ایس ای سی عوامی اجلاس", "Official U.S. Securities and Exchange Commission public-meeting and event schedule.", "sec", "https://www.sec.gov/newsroom/meetings-events", "https://www.sec.gov/about/privacy-information", "Source: U.S. Securities and Exchange Commission. The SEC does not endorse Jalwa.", HOSTS.sec],
  ["fcc-open-meetings", "FCC Open Meetings and Workshops", "ایف سی سی کھلے اجلاس اور ورکشاپس", "Official Federal Communications Commission live meeting and workshop coverage.", "fcc", "https://www.fcc.gov/live", "https://www.fcc.gov/encyclopedia/website-policies-notices", "Source: Federal Communications Commission. The FCC does not endorse Jalwa.", HOSTS.fcc],
  ["europe-by-satellite-ebs", "Europe by Satellite — EbS", "یورپ بائی سیٹلائٹ ای بی ایس", "Official European Commission EbS live audiovisual service. Jalwa opens the official ad-free service and does not restream it.", "european_commission", "https://audiovisual.ec.europa.eu/en/ebs/live/1", "https://commission.europa.eu/legal-notice_en", "© European Union, 2026 — Source: European Commission Audiovisual Service. No endorsement of Jalwa is implied.", HOSTS.eu],
  ["europe-by-satellite-ebs-plus", "Europe by Satellite — EbS+", "یورپ بائی سیٹلائٹ ای بی ایس پلس", "Official European Commission EbS+ live audiovisual service. Jalwa opens the official ad-free service and does not restream it.", "european_commission", "https://audiovisual.ec.europa.eu/en/ebs/live/2", "https://commission.europa.eu/legal-notice_en", "© European Union, 2026 — Source: European Commission Audiovisual Service. No endorsement of Jalwa is implied.", HOSTS.eu],
  ["us-house-floorcast", "U.S. House FloorCast", "امریکی ایوان نمائندگان فلور کاسٹ", "Official U.S. House floor proceedings. This entry is official-link only and must remain free of commercial sponsorship around the source.", "us_house", "https://live.house.gov/", "https://www.house.gov/website-information/content", "Source: U.S. House of Representatives. The House does not endorse Jalwa.", HOSTS.house],
  ["us-senate-floor-webcast", "U.S. Senate Floor Webcast", "امریکی سینیٹ فلور ویب کاسٹ", "Official U.S. Senate floor webcast and daily proceedings schedule.", "us_senate", "https://www.senate.gov/floor/", "https://www.senate.gov/general/copyright.htm", "Source: United States Senate. The Senate does not endorse Jalwa.", HOSTS.senate],
];

const npsRows = [
  ["nps-devils-tower-entrance", "NPS Devils Tower Entrance", "نیشنل پارک سروس ڈیولز ٹاور داخلی منظر", "Current official National Park Service view near the Devils Tower entrance.", "353840EE-9D49-67A6-C3D2292B5251E4DD"],
  ["nps-mount-rainier-sunrise", "NPS Mount Rainier Sunrise", "ماؤنٹ رینیئر سن رائز منظر", "Current official National Park Service view from Sunrise at Mount Rainier.", "81B462EC-1DD8-B71B-0B99F890C596FA16"],
  ["nps-mount-rainier-paradise", "NPS Mount Rainier Paradise", "ماؤنٹ رینیئر پیراڈائز منظر", "Current official National Park Service mountain view from Paradise.", "81B46307-1DD8-B71B-0B72918A4B2EB790"],
  ["nps-mount-rainier-tatoosh", "NPS Mount Rainier Tatoosh Range", "ماؤنٹ رینیئر ٹیٹوش رینج", "Current official National Park Service view of the Tatoosh Range.", "81B46402-1DD8-B71B-0B95C911C1395AAC"],
  ["nps-guadalupe-pine-springs", "NPS Guadalupe Pine Springs Canyon", "گواڈالوپ پائن اسپرنگز کینین", "Current official National Park Service view from Pine Springs Canyon.", "E73E3175-DF46-3AF2-28593FC1F83AE264"],
  ["nps-guadalupe-el-capitan", "NPS Guadalupe El Capitan", "گواڈالوپ ایل کیپٹن منظر", "Current official National Park Service view of El Capitan.", "9849DE2B-BC23-1110-33CED7C04E8AAF05"],
  ["nps-shenandoah-mountain-view", "NPS Shenandoah Mountain View", "شیننڈوا پہاڑی منظر", "Current official National Park Service mountain view in Shenandoah.", "81B46B71-1DD8-B71B-0B55074571E08B1E"],
  ["nps-shenandoah-big-meadows", "NPS Shenandoah Big Meadows", "شیننڈوا بگ میڈوز", "Current official National Park Service view of Big Meadows.", "81B46B99-1DD8-B71B-0B124A40CC3384CE"],
  ["nps-smokies-newfound-gap", "NPS Great Smoky Mountains Newfound Gap", "گریٹ اسموکی ماؤنٹینز نیوفاؤنڈ گیپ", "Current official National Park Service view at Newfound Gap.", "C589EEEF-1DD8-B71B-0B0463C308FF64DD"],
  ["nps-point-reyes-beach", "NPS Point Reyes Beach", "پوائنٹ ریئس ساحلی منظر", "Current official National Park Service beach view at Point Reyes.", "5A967BB2-CB78-43A7-1C861C4554D5D50D"],
  ["nps-yellowstone-electric-peak", "NPS Yellowstone Electric Peak", "ییلو اسٹون الیکٹرک پیک", "Current official National Park Service north-entrance and Electric Peak view.", "81B468AB-1DD8-B71B-0BE84D8E8E0F1112"],
  ["nps-glacier-night-sky", "NPS Glacier Night Sky", "گلیشیئر نائٹ اسکائی", "Current official National Park Service night-sky view in Glacier National Park.", "D4BDFE7E-AC7F-D681-8A03C820E06CBA0A"],
  ["nps-bunker-hill-west", "NPS Bunker Hill Monument West View", "بنکر ہل یادگار مغربی منظر", "Current official National Park Service westward view from Bunker Hill Monument.", "B17835F2-AC01-8A62-F2F0EC85B33643D3"],
  ["nps-painted-desert-inn", "NPS Painted Desert Inn", "پینٹڈ ڈیزرٹ اِن منظر", "Current official National Park Service view at Painted Desert Inn.", "81B46C72-1DD8-B71B-0BDC8D1824EBB9A7"],
  ["nps-el-morro", "NPS El Morro National Monument", "ایل مورو قومی یادگار", "Current official National Park Service view at El Morro National Monument.", "81B46AD5-1DD8-B71B-0BFB3F36B5DDC6EF"],
];

export const OPEN_GOVERNMENT_LIVE_SOURCES = Object.fromEntries([
  ...linkRows.map(officialLink),
  ...npsRows.map(npsCamera),
]);

export const OPEN_GOVERNMENT_TOP_LEVEL_KEYS = Object.keys(OPEN_GOVERNMENT_LIVE_SOURCES);

Object.assign(LIVE_SOURCE_REGISTRY, OPEN_GOVERNMENT_LIVE_SOURCES);
