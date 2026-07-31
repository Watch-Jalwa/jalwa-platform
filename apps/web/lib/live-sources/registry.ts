export type LiveDeliveryAdapter = "official_live_embed" | "public_domain_live_image";
export type LiveAvailability = "healthy" | "degraded" | "off_air" | "unavailable";

export type LiveSourceDefinition = {
  key: string;
  slug: string;
  title: string;
  titleUrdu?: string;
  description: string;
  provider: "nasa" | "noaa" | "usgs";
  adapter: LiveDeliveryAdapter;
  officialSourceUrl: string;
  termsUrl: string;
  attribution: string;
  allowedHosts: readonly string[];
  embedVideoId?: string;
  iframeIndex?: number;
  imageUrl?: string;
  refreshIntervalSeconds: number;
  freshnessThresholdSeconds: number;
  offAirAllowed?: boolean;
  collection?: "usgs-mauna-loa-live" | "usgs-rivers-lakes-live";
};

const YOUTUBE_HOSTS = ["www.youtube.com", "www.youtube-nocookie.com", "youtube.com"] as const;
const USGS_IMAGE_HOSTS = [
  "www.usgs.gov",
  "volcanoes.usgs.gov",
  "apps.usgs.gov",
  "usgs-nims-images.s3.amazonaws.com",
] as const;

export const LIVE_SOURCE_REGISTRY = {
  "nasa-space-station-views": {
    key: "nasa-space-station-views",
    slug: "nasa-space-station-views",
    title: "NASA Space Station Views",
    titleUrdu: "ناسا خلائی اسٹیشن کے براہ راست مناظر",
    description: "Live views from the International Space Station with mission audio when available.",
    provider: "nasa",
    adapter: "official_live_embed",
    officialSourceUrl: "https://www.nasa.gov/live/",
    termsUrl: "https://www.nasa.gov/nasa-brand-center/images-and-media/",
    attribution: "Source: NASA. NASA does not endorse Jalwa or its advertisers.",
    allowedHosts: ["www.nasa.gov", ...YOUTUBE_HOSTS],
    embedVideoId: "MuHIx2q0Wjs",
    refreshIntervalSeconds: 900,
    freshnessThresholdSeconds: 86400,
  },
  "noaa-ocean-camera-1": {
    key: "noaa-ocean-camera-1",
    slug: "noaa-ocean-exploration-camera-1",
    title: "NOAA Ocean Exploration Camera 1",
    titleUrdu: "نوآ سمندری تحقیق کیمرا 1",
    description: "Official NOAA Ocean Exploration live video. Audio is generally available during dives.",
    provider: "noaa",
    adapter: "official_live_embed",
    officialSourceUrl: "https://oceanexplorer.noaa.gov/livestreams/",
    termsUrl: "https://oceanexplorer.noaa.gov/about/media-kit/",
    attribution: "Courtesy of NOAA Ocean Exploration.",
    allowedHosts: ["oceanexplorer.noaa.gov", ...YOUTUBE_HOSTS],
    iframeIndex: 0,
    refreshIntervalSeconds: 300,
    freshnessThresholdSeconds: 3600,
    offAirAllowed: true,
  },
  "noaa-ocean-camera-2": {
    key: "noaa-ocean-camera-2",
    slug: "noaa-ocean-exploration-camera-2",
    title: "NOAA Ocean Exploration Camera 2",
    titleUrdu: "نوآ سمندری تحقیق کیمرا 2",
    description: "Official NOAA Ocean Exploration secondary live camera.",
    provider: "noaa",
    adapter: "official_live_embed",
    officialSourceUrl: "https://oceanexplorer.noaa.gov/livestreams/",
    termsUrl: "https://oceanexplorer.noaa.gov/about/media-kit/",
    attribution: "Courtesy of NOAA Ocean Exploration.",
    allowedHosts: ["oceanexplorer.noaa.gov", ...YOUTUBE_HOSTS],
    iframeIndex: 1,
    refreshIntervalSeconds: 300,
    freshnessThresholdSeconds: 3600,
    offAirAllowed: true,
  },
  "noaa-ocean-camera-3": {
    key: "noaa-ocean-camera-3",
    slug: "noaa-ocean-exploration-camera-3",
    title: "NOAA Ocean Exploration Camera 3",
    titleUrdu: "نوآ سمندری تحقیق کیمرا 3",
    description: "Official NOAA Ocean Exploration live video. Audio is generally available during dives.",
    provider: "noaa",
    adapter: "official_live_embed",
    officialSourceUrl: "https://oceanexplorer.noaa.gov/livestreams/",
    termsUrl: "https://oceanexplorer.noaa.gov/about/media-kit/",
    attribution: "Courtesy of NOAA Ocean Exploration.",
    allowedHosts: ["oceanexplorer.noaa.gov", ...YOUTUBE_HOSTS],
    iframeIndex: 2,
    refreshIntervalSeconds: 300,
    freshnessThresholdSeconds: 3600,
    offAirAllowed: true,
  },
  "usgs-kilauea-v1": {
    key: "usgs-kilauea-v1",
    slug: "usgs-kilauea-v1",
    title: "USGS Kīlauea V1",
    titleUrdu: "یو ایس جی ایس کیلاؤیا V1",
    description: "Live western view of Halemaʻumaʻu crater from the Kīlauea summit.",
    provider: "usgs",
    adapter: "official_live_embed",
    officialSourceUrl: "https://www.usgs.gov/volcanoes/kilauea/v1cam-kilauea-volcano-hawaii-west-halemaumau-crater",
    termsUrl: "https://www.usgs.gov/information-policies-and-instructions/copyrights-and-credits",
    attribution: "Source: U.S. Geological Survey. Public domain.",
    allowedHosts: ["www.usgs.gov", "url.usgs.gov", ...YOUTUBE_HOSTS],
    embedVideoId: "HggWKlZv9yk",
    refreshIntervalSeconds: 900,
    freshnessThresholdSeconds: 86400,
  },
  "usgs-kilauea-v2": {
    key: "usgs-kilauea-v2",
    slug: "usgs-kilauea-v2",
    title: "USGS Kīlauea V2",
    titleUrdu: "یو ایس جی ایس کیلاؤیا V2",
    description: "Live eastern view of Halemaʻumaʻu crater from the Kīlauea summit.",
    provider: "usgs",
    adapter: "official_live_embed",
    officialSourceUrl: "https://www.usgs.gov/media/webcams/v2cam-kilauea-volcano-hawaii-east-halemaumau-crater",
    termsUrl: "https://www.usgs.gov/information-policies-and-instructions/copyrights-and-credits",
    attribution: "Source: U.S. Geological Survey. Public domain.",
    allowedHosts: ["www.usgs.gov", "url.usgs.gov", ...YOUTUBE_HOSTS],
    embedVideoId: "fiyttmA7YkA",
    refreshIntervalSeconds: 900,
    freshnessThresholdSeconds: 86400,
  },
  "usgs-kilauea-v3": {
    key: "usgs-kilauea-v3",
    slug: "usgs-kilauea-v3",
    title: "USGS Kīlauea V3",
    titleUrdu: "یو ایس جی ایس کیلاؤیا V3",
    description: "Live southern view of Halemaʻumaʻu crater from the Kīlauea summit.",
    provider: "usgs",
    adapter: "official_live_embed",
    officialSourceUrl: "https://www.usgs.gov/media/webcams/v3cam-kilauea-volcano-hawaii-south-halemaumau-crater",
    termsUrl: "https://www.usgs.gov/information-policies-and-instructions/copyrights-and-credits",
    attribution: "Source: U.S. Geological Survey. Public domain.",
    allowedHosts: ["www.usgs.gov", "url.usgs.gov", ...YOUTUBE_HOSTS],
    embedVideoId: "BqmpkUdMtyA",
    refreshIntervalSeconds: 900,
    freshnessThresholdSeconds: 86400,
  },
  "usgs-mauna-loa-mlcam": {
    key: "usgs-mauna-loa-mlcam",
    slug: "usgs-mauna-loa-mlcam",
    title: "USGS Mauna Loa Caldera",
    description: "Current visible view of Mokuʻāweoweo caldera.",
    provider: "usgs",
    adapter: "public_domain_live_image",
    officialSourceUrl: "https://www.usgs.gov/volcanoes/mauna-loa/webcams",
    termsUrl: "https://www.usgs.gov/information-policies-and-instructions/copyrights-and-credits",
    attribution: "Source: U.S. Geological Survey. Public domain.",
    allowedHosts: USGS_IMAGE_HOSTS,
    imageUrl: "https://volcanoes.usgs.gov/cams/MLcam/images/M.jpg",
    refreshIntervalSeconds: 300,
    freshnessThresholdSeconds: 3600,
    collection: "usgs-mauna-loa-live",
  },
  "usgs-mauna-loa-mtcam": {
    key: "usgs-mauna-loa-mtcam",
    slug: "usgs-mauna-loa-mtcam",
    title: "USGS Mauna Loa Thermal View",
    description: "Current thermal view of Mokuʻāweoweo caldera.",
    provider: "usgs",
    adapter: "public_domain_live_image",
    officialSourceUrl: "https://www.usgs.gov/volcanoes/mauna-loa/webcams",
    termsUrl: "https://www.usgs.gov/information-policies-and-instructions/copyrights-and-credits",
    attribution: "Source: U.S. Geological Survey. Public domain.",
    allowedHosts: USGS_IMAGE_HOSTS,
    imageUrl: "https://volcanoes.usgs.gov/cams/MTcam/images/M.jpg",
    refreshIntervalSeconds: 300,
    freshnessThresholdSeconds: 3600,
    collection: "usgs-mauna-loa-live",
  },
  "usgs-mauna-loa-mk2cam": {
    key: "usgs-mauna-loa-mk2cam",
    slug: "usgs-mauna-loa-mk2cam",
    title: "USGS Mauna Loa Summit and Northeast Rift",
    description: "Current summit and Northeast Rift Zone view with Mauna Kea in the distance.",
    provider: "usgs",
    adapter: "public_domain_live_image",
    officialSourceUrl: "https://www.usgs.gov/media/webcams/mk2cam-mauna-loas-summit-and-northeast-rift-zone-mauna-kea",
    termsUrl: "https://www.usgs.gov/information-policies-and-instructions/copyrights-and-credits",
    attribution: "Source: U.S. Geological Survey. Public domain.",
    allowedHosts: USGS_IMAGE_HOSTS,
    imageUrl: "https://volcanoes.usgs.gov/cams/MK2cam/images/M.jpg",
    refreshIntervalSeconds: 300,
    freshnessThresholdSeconds: 3600,
    collection: "usgs-mauna-loa-live",
  },
  "usgs-mauna-loa-mkcam": {
    key: "usgs-mauna-loa-mkcam",
    slug: "usgs-mauna-loa-mkcam",
    title: "USGS Mauna Loa Northwest Flank",
    description: "Current view of Mauna Loa's northwest flank.",
    provider: "usgs",
    adapter: "public_domain_live_image",
    officialSourceUrl: "https://www.usgs.gov/volcanoes/mauna-loa/webcams",
    termsUrl: "https://www.usgs.gov/information-policies-and-instructions/copyrights-and-credits",
    attribution: "Source: U.S. Geological Survey. Public domain.",
    allowedHosts: USGS_IMAGE_HOSTS,
    imageUrl: "https://volcanoes.usgs.gov/cams/MKcam/images/M.jpg",
    refreshIntervalSeconds: 300,
    freshnessThresholdSeconds: 3600,
    collection: "usgs-mauna-loa-live",
  },
  "usgs-river-pequest": {
    key: "usgs-river-pequest",
    slug: "usgs-river-pequest",
    title: "USGS Pequest River",
    description: "Current view at USGS Streamgage 01445500, Pequest, New Jersey.",
    provider: "usgs",
    adapter: "public_domain_live_image",
    officialSourceUrl: "https://www.usgs.gov/media/webcams/streamgage-01445500-pequest-river-pequest-nj",
    termsUrl: "https://www.usgs.gov/information-policies-and-instructions/copyrights-and-credits",
    attribution: "Source: U.S. Geological Survey. Public domain.",
    allowedHosts: USGS_IMAGE_HOSTS,
    imageUrl: "https://usgs-nims-images.s3.amazonaws.com/overlay/NJ_Pequest_River_at_Pequest/NJ_Pequest_River_at_Pequest_newest.jpg",
    refreshIntervalSeconds: 300,
    freshnessThresholdSeconds: 3600,
    collection: "usgs-rivers-lakes-live",
  },
  "usgs-river-delaware-belvidere": {
    key: "usgs-river-delaware-belvidere",
    slug: "usgs-river-delaware-belvidere",
    title: "USGS Delaware River at Belvidere",
    description: "Current view at USGS Streamgage 01446500, Belvidere, New Jersey.",
    provider: "usgs",
    adapter: "public_domain_live_image",
    officialSourceUrl: "https://www.usgs.gov/media/webcams/streamgage-01446500-delaware-river-belvidere-nj",
    termsUrl: "https://www.usgs.gov/information-policies-and-instructions/copyrights-and-credits",
    attribution: "Source: U.S. Geological Survey. Public domain.",
    allowedHosts: USGS_IMAGE_HOSTS,
    imageUrl: "https://apps.usgs.gov/hivis/camera/NJ_Delaware_River_at_Belvidere",
    refreshIntervalSeconds: 300,
    freshnessThresholdSeconds: 3600,
    collection: "usgs-rivers-lakes-live",
  },
  "usgs-lake-hopatcong": {
    key: "usgs-lake-hopatcong",
    slug: "usgs-lake-hopatcong",
    title: "USGS Lake Hopatcong",
    description: "Current view at USGS Streamgage 01455400, Landing, New Jersey.",
    provider: "usgs",
    adapter: "public_domain_live_image",
    officialSourceUrl: "https://www.usgs.gov/media/webcams/streamgage-01455400-lake-hopatcong-landing-nj",
    termsUrl: "https://www.usgs.gov/information-policies-and-instructions/copyrights-and-credits",
    attribution: "Source: U.S. Geological Survey. Public domain.",
    allowedHosts: USGS_IMAGE_HOSTS,
    imageUrl: "https://apps.usgs.gov/hivis/camera/NJ_Lake_Hopatcong_at_Landing",
    refreshIntervalSeconds: 300,
    freshnessThresholdSeconds: 3600,
    collection: "usgs-rivers-lakes-live",
  },
  "usgs-river-rancocas": {
    key: "usgs-river-rancocas",
    slug: "usgs-river-rancocas",
    title: "USGS North Branch Rancocas Creek",
    description: "Current view at USGS Streamgage 01467000, Pemberton, New Jersey.",
    provider: "usgs",
    adapter: "public_domain_live_image",
    officialSourceUrl: "https://www.usgs.gov/media/webcams/streamgage-01467000-north-branch-rancocas-creek-pemberton-nj",
    termsUrl: "https://www.usgs.gov/information-policies-and-instructions/copyrights-and-credits",
    attribution: "Source: U.S. Geological Survey. Public domain.",
    allowedHosts: USGS_IMAGE_HOSTS,
    imageUrl: "https://apps.usgs.gov/hivis/camera/NJ_North_Branch_Rancocas_Creek_at_Pemberton",
    refreshIntervalSeconds: 300,
    freshnessThresholdSeconds: 3600,
    collection: "usgs-rivers-lakes-live",
  },
} as const satisfies Record<string, LiveSourceDefinition>;

export type LiveSourceKey = keyof typeof LIVE_SOURCE_REGISTRY;

export const TOP_LEVEL_LIVE_SOURCE_KEYS = [
  "nasa-space-station-views",
  "noaa-ocean-camera-1",
  "noaa-ocean-camera-2",
  "noaa-ocean-camera-3",
  "usgs-kilauea-v1",
  "usgs-kilauea-v2",
  "usgs-kilauea-v3",
] as const satisfies readonly LiveSourceKey[];

export const LIVE_COLLECTIONS = [
  { slug: "usgs-mauna-loa-live", title: "USGS Mauna Loa Webcams", description: "Public-domain current views from Mauna Loa." },
  { slug: "usgs-rivers-lakes-live", title: "USGS Rivers and Lakes", description: "Public-domain current views from selected USGS streamgages." },
] as const;

export function liveSourcesEnabled() {
  return process.env.PUBLIC_DOMAIN_LIVE_SOURCES_ENABLED === "true";
}

export function getLiveSourceDefinition(value: string): LiveSourceDefinition | null {
  return Object.prototype.hasOwnProperty.call(LIVE_SOURCE_REGISTRY, value)
    ? LIVE_SOURCE_REGISTRY[value as LiveSourceKey]
    : null;
}

export function officialYouTubeEmbed(videoId: string) {
  if (!/^[A-Za-z0-9_-]{11}$/.test(videoId)) throw new Error("Invalid approved YouTube video ID.");
  return `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=0&playsinline=1&rel=0`;
}
