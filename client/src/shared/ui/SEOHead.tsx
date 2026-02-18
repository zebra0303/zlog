import { Helmet } from "react-helmet-async";
import { useSiteSettingsStore } from "@/features/site-settings/model/store";

interface SEOHeadProps {
  title?: string;
  description?: string;
  image?: string;
  type?: string;
  url?: string;
  publishedTime?: string;
  modifiedTime?: string;
  author?: string;
  tags?: string[];
}

// JSON-LD is injected server-side via SSR, so the client only manages meta tags
export function SEOHead({
  title,
  description,
  image,
  type = "website",
  url,
  publishedTime,
  modifiedTime,
  author,
  tags,
}: SEOHeadProps) {
  const settings = useSiteSettingsStore((s) => s.settings);
  const blogTitle = settings.blog_title ?? "zlog";
  const seoDescription = settings.seo_description;
  const seoOgImage = settings.seo_og_image;
  const themeColor = settings.header_bg_color_dark ?? "#1A1A24";
  const finalDescription = description ?? seoDescription;
  const finalImage = image ?? seoOgImage;
  const fullTitle = title ? `${blogTitle} - ${title}` : blogTitle;
  const ogType = type === "collectionpage" ? "website" : type;

  const canonicalBase = (settings.canonical_url ?? window.location.origin).replace(/\/$/, "");
  const canonicalUrl = url
    ? `${canonicalBase}${new URL(url, window.location.origin).pathname}`
    : `${canonicalBase}${window.location.pathname}`;

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <link rel="canonical" href={canonicalUrl} />
      <meta name="theme-color" content={themeColor} />
      {finalDescription && <meta name="description" content={finalDescription} />}
      <meta property="og:title" content={fullTitle} />
      {finalDescription && <meta property="og:description" content={finalDescription} />}
      {finalImage && <meta property="og:image" content={finalImage} />}
      <meta property="og:type" content={ogType} />
      <meta property="og:url" content={canonicalUrl} />
      {publishedTime && <meta property="article:published_time" content={publishedTime} />}
      {modifiedTime && <meta property="article:modified_time" content={modifiedTime} />}
      {author && <meta property="article:author" content={author} />}
      {tags?.map((tag) => (
        <meta key={tag} property="article:tag" content={tag} />
      ))}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      {finalDescription && <meta name="twitter:description" content={finalDescription} />}
      {finalImage && <meta name="twitter:image" content={finalImage} />}
    </Helmet>
  );
}
