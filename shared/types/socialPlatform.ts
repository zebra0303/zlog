export const SOCIAL_PLATFORMS = {
  github: { label: "GitHub", icon: "github", urlPrefix: "https://github.com/" },
  twitter: { label: "X (Twitter)", icon: "twitter", urlPrefix: "https://x.com/" },
  instagram: { label: "Instagram", icon: "instagram", urlPrefix: "https://instagram.com/" },
  linkedin: { label: "LinkedIn", icon: "linkedin", urlPrefix: "https://linkedin.com/in/" },
  youtube: { label: "YouTube", icon: "youtube", urlPrefix: "https://youtube.com/" },
  facebook: { label: "Facebook", icon: "facebook", urlPrefix: "https://facebook.com/" },
  threads: { label: "Threads", icon: "at-sign", urlPrefix: "https://threads.net/" },
  mastodon: { label: "Mastodon", icon: "message-circle", urlPrefix: "" },
  bluesky: { label: "Bluesky", icon: "cloud", urlPrefix: "https://bsky.app/profile/" },
  website: { label: "Website", icon: "globe", urlPrefix: "" },
  email: { label: "Email", icon: "mail", urlPrefix: "mailto:" },
  rss: { label: "RSS", icon: "rss", urlPrefix: "" },
  custom: { label: "Custom", icon: "link", urlPrefix: "" },
} as const;

export type SocialPlatformKey = keyof typeof SOCIAL_PLATFORMS;
