import { Helmet } from "react-helmet-async";
import { useSiteSettingsStore } from "@/features/site-settings/model/store";

interface SEOHeadProps {
  title?: string; description?: string; image?: string; type?: string;
  url?: string; publishedTime?: string; author?: string; tags?: string[];
}

export function SEOHead({ title, description, image, type = "website", url, publishedTime, author, tags }: SEOHeadProps) {
  const blogTitle = useSiteSettingsStore((s) => s.settings.blog_title) || "zlog";
  const fullTitle = title ? `${blogTitle} - ${title}` : blogTitle;
  return (
    <Helmet>
      <title>{fullTitle}</title>
      {description && <meta name="description" content={description} />}
      <meta property="og:title" content={fullTitle} />
      {description && <meta property="og:description" content={description} />}
      {image && <meta property="og:image" content={image} />}
      <meta property="og:type" content={type} />
      {url && <meta property="og:url" content={url} />}
      {publishedTime && <meta property="article:published_time" content={publishedTime} />}
      {author && <meta property="article:author" content={author} />}
      {tags?.map((tag) => <meta key={tag} property="article:tag" content={tag} />)}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      {description && <meta name="twitter:description" content={description} />}
      {image && <meta name="twitter:image" content={image} />}
    </Helmet>
  );
}
