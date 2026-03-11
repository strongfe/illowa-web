import type { MetadataRoute } from 'next';

const siteUrl = 'https://illowa-hotel.com';
const locales = ['ko', 'en', 'ja', 'zh', 'ru', 'es', 'fr', 'pt', 'id', 'hi'] as const;
const legalPaths = ['terms', 'privacy', 'cookies'] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  const baseEntries: MetadataRoute.Sitemap = ['/', '/terms', '/privacy', '/cookies'].map((path) => ({
    url: `${siteUrl}${path}`,
    lastModified,
  }));

  const localeHomeEntries: MetadataRoute.Sitemap = locales.map((locale) => ({
    url: `${siteUrl}/${locale}`,
    lastModified,
  }));

  const localeLegalEntries: MetadataRoute.Sitemap = locales.flatMap((locale) =>
    legalPaths.map((path) => ({
      url: `${siteUrl}/${locale}/${path}`,
      lastModified,
    }))
  );

  return [...baseEntries, ...localeHomeEntries, ...localeLegalEntries];
}
