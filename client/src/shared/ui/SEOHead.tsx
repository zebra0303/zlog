import { useMemo } from "react";
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
  articleSection?: string;
  numberOfItems?: number;
}

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
  articleSection,
  numberOfItems,
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

  const jsonLd = useMemo(() => {
    const siteUrl = window.location.origin;

    if (type === "website") {
      const data: Record<string, unknown> = {
        "@context": "https://schema.org",
        "@type": "WebSite",
        name: blogTitle,
        url: url ?? siteUrl,
        ...(finalDescription && { description: finalDescription }),
        ...(finalImage && { image: finalImage }),
        potentialAction: {
          "@type": "SearchAction",
          target: {
            "@type": "EntryPoint",
            urlTemplate: `${siteUrl}/?search={search_term_string}`,
          },
          "query-input": "required name=search_term_string",
        },
      };
      return JSON.stringify(data);
    }

    if (type === "collectionpage" && title) {
      const data: Record<string, unknown> = {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        name: title,
        ...(finalDescription && { description: finalDescription }),
        url: url ?? siteUrl,
        isPartOf: {
          "@type": "WebSite",
          name: blogTitle,
          url: siteUrl,
        },
        ...(numberOfItems != null && { numberOfItems }),
      };
      return JSON.stringify(data);
    }

    if (type === "article" && title) {
      const authorName = settings.blog_title ?? "zlog";
      const data: Record<string, unknown> = {
        "@context": "https://schema.org",
        "@type": "BlogPosting",
        headline: title,
        ...(finalDescription && { description: finalDescription }),
        ...(finalImage && { image: finalImage }),
        ...(publishedTime && { datePublished: publishedTime }),
        ...(modifiedTime && { dateModified: modifiedTime }),
        author: {
          "@type": "Person",
          name: authorName,
          url: `${siteUrl}/profile`,
        },
        publisher: {
          "@type": "Organization",
          name: blogTitle,
          logo: {
            "@type": "ImageObject",
            url: `${siteUrl}/favicons/favicon.svg`,
          },
        },
        mainEntityOfPage: {
          "@type": "WebPage",
          "@id": url ?? siteUrl,
        },
        ...(articleSection && { articleSection }),
        ...(tags && tags.length > 0 && { keywords: tags }),
      };
      return JSON.stringify(data);
    }

    return null;
  }, [
    type,
    title,
    finalDescription,
    finalImage,
    publishedTime,
    modifiedTime,
    url,
    blogTitle,
    settings.blog_title,
    tags,
    articleSection,
    numberOfItems,
  ]);

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="theme-color" content={themeColor} />
      {finalDescription && <meta name="description" content={finalDescription} />}
      <meta property="og:title" content={fullTitle} />
      {finalDescription && <meta property="og:description" content={finalDescription} />}
      {finalImage && <meta property="og:image" content={finalImage} />}
      <meta property="og:type" content={ogType} />
      {url && <meta property="og:url" content={url} />}
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
      {jsonLd && <script type="application/ld+json">{jsonLd}</script>}
    </Helmet>
  );
}
