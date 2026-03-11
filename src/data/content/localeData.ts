import { routing } from '@/i18n/routing';

import aboutKo from '@/data/content/ko/about.json';
import aboutEn from '@/data/content/en/about.json';
import aboutJa from '@/data/content/ja/about.json';
import aboutZh from '@/data/content/zh/about.json';
import aboutRu from '@/data/content/ru/about.json';
import aboutEs from '@/data/content/es/about.json';
import aboutFr from '@/data/content/fr/about.json';
import aboutPt from '@/data/content/pt/about.json';
import aboutId from '@/data/content/id/about.json';
import aboutHi from '@/data/content/hi/about.json';

import contactKo from '@/data/content/ko/contact.json';
import contactEn from '@/data/content/en/contact.json';
import contactJa from '@/data/content/ja/contact.json';
import contactZh from '@/data/content/zh/contact.json';
import contactRu from '@/data/content/ru/contact.json';
import contactEs from '@/data/content/es/contact.json';
import contactFr from '@/data/content/fr/contact.json';
import contactPt from '@/data/content/pt/contact.json';
import contactId from '@/data/content/id/contact.json';
import contactHi from '@/data/content/hi/contact.json';

import roomsKo from '@/data/content/ko/rooms.json';
import roomsEn from '@/data/content/en/rooms.json';
import roomsJa from '@/data/content/ja/rooms.json';
import roomsZh from '@/data/content/zh/rooms.json';
import roomsRu from '@/data/content/ru/rooms.json';
import roomsEs from '@/data/content/es/rooms.json';
import roomsFr from '@/data/content/fr/rooms.json';
import roomsPt from '@/data/content/pt/rooms.json';
import roomsId from '@/data/content/id/rooms.json';
import roomsHi from '@/data/content/hi/rooms.json';

import ratesKo from '@/data/content/ko/rates.json';
import ratesEn from '@/data/content/en/rates.json';
import ratesJa from '@/data/content/ja/rates.json';
import ratesZh from '@/data/content/zh/rates.json';
import ratesRu from '@/data/content/ru/rates.json';
import ratesEs from '@/data/content/es/rates.json';
import ratesFr from '@/data/content/fr/rates.json';
import ratesPt from '@/data/content/pt/rates.json';
import ratesId from '@/data/content/id/rates.json';
import ratesHi from '@/data/content/hi/rates.json';

import amenitiesKo from '@/data/content/ko/amenities.json';
import amenitiesEn from '@/data/content/en/amenities.json';
import amenitiesJa from '@/data/content/ja/amenities.json';
import amenitiesZh from '@/data/content/zh/amenities.json';
import amenitiesRu from '@/data/content/ru/amenities.json';
import amenitiesEs from '@/data/content/es/amenities.json';
import amenitiesFr from '@/data/content/fr/amenities.json';
import amenitiesPt from '@/data/content/pt/amenities.json';
import amenitiesId from '@/data/content/id/amenities.json';
import amenitiesHi from '@/data/content/hi/amenities.json';

import galleryKo from '@/data/content/ko/gallery.json';
import galleryEn from '@/data/content/en/gallery.json';
import galleryJa from '@/data/content/ja/gallery.json';
import galleryZh from '@/data/content/zh/gallery.json';
import galleryRu from '@/data/content/ru/gallery.json';
import galleryEs from '@/data/content/es/gallery.json';
import galleryFr from '@/data/content/fr/gallery.json';
import galleryPt from '@/data/content/pt/gallery.json';
import galleryId from '@/data/content/id/gallery.json';
import galleryHi from '@/data/content/hi/gallery.json';

import bathroomKo from '@/data/content/ko/bathroom.json';
import bathroomEn from '@/data/content/en/bathroom.json';
import bathroomJa from '@/data/content/ja/bathroom.json';
import bathroomZh from '@/data/content/zh/bathroom.json';
import bathroomRu from '@/data/content/ru/bathroom.json';
import bathroomEs from '@/data/content/es/bathroom.json';
import bathroomFr from '@/data/content/fr/bathroom.json';
import bathroomPt from '@/data/content/pt/bathroom.json';
import bathroomId from '@/data/content/id/bathroom.json';
import bathroomHi from '@/data/content/hi/bathroom.json';

import businessKo from '@/data/content/ko/business.json';
import businessEn from '@/data/content/en/business.json';
import businessJa from '@/data/content/ja/business.json';
import businessZh from '@/data/content/zh/business.json';
import businessRu from '@/data/content/ru/business.json';
import businessEs from '@/data/content/es/business.json';
import businessFr from '@/data/content/fr/business.json';
import businessPt from '@/data/content/pt/business.json';
import businessId from '@/data/content/id/business.json';
import businessHi from '@/data/content/hi/business.json';

import snackbarKo from '@/data/content/ko/snackbar.json';
import snackbarEn from '@/data/content/en/snackbar.json';
import snackbarJa from '@/data/content/ja/snackbar.json';
import snackbarZh from '@/data/content/zh/snackbar.json';
import snackbarRu from '@/data/content/ru/snackbar.json';
import snackbarEs from '@/data/content/es/snackbar.json';
import snackbarFr from '@/data/content/fr/snackbar.json';
import snackbarPt from '@/data/content/pt/snackbar.json';
import snackbarId from '@/data/content/id/snackbar.json';
import snackbarHi from '@/data/content/hi/snackbar.json';

export type Locale = (typeof routing.locales)[number];

export const aboutByLocale: Record<Locale, typeof aboutKo> = {
  ko: aboutKo,
  en: aboutEn,
  ja: aboutJa,
  zh: aboutZh,
  ru: aboutRu,
  es: aboutEs,
  fr: aboutFr,
  pt: aboutPt,
  id: aboutId,
  hi: aboutHi,
};

export const contactByLocale: Record<Locale, typeof contactKo> = {
  ko: contactKo,
  en: contactEn,
  ja: contactJa,
  zh: contactZh,
  ru: contactRu,
  es: contactEs,
  fr: contactFr,
  pt: contactPt,
  id: contactId,
  hi: contactHi,
};

export const roomsByLocale: Record<Locale, typeof roomsKo> = {
  ko: roomsKo,
  en: roomsEn,
  ja: roomsJa,
  zh: roomsZh,
  ru: roomsRu,
  es: roomsEs,
  fr: roomsFr,
  pt: roomsPt,
  id: roomsId,
  hi: roomsHi,
};

export const ratesByLocale: Record<Locale, typeof ratesKo> = {
  ko: ratesKo,
  en: ratesEn,
  ja: ratesJa,
  zh: ratesZh,
  ru: ratesRu,
  es: ratesEs,
  fr: ratesFr,
  pt: ratesPt,
  id: ratesId,
  hi: ratesHi,
};

export const amenitiesByLocale: Record<Locale, typeof amenitiesKo> = {
  ko: amenitiesKo,
  en: amenitiesEn,
  ja: amenitiesJa,
  zh: amenitiesZh,
  ru: amenitiesRu,
  es: amenitiesEs,
  fr: amenitiesFr,
  pt: amenitiesPt,
  id: amenitiesId,
  hi: amenitiesHi,
};

export const galleryByLocale: Record<Locale, typeof galleryKo> = {
  ko: galleryKo,
  en: galleryEn,
  ja: galleryJa,
  zh: galleryZh,
  ru: galleryRu,
  es: galleryEs,
  fr: galleryFr,
  pt: galleryPt,
  id: galleryId,
  hi: galleryHi,
};

export const bathroomByLocale: Record<Locale, typeof bathroomKo> = {
  ko: bathroomKo,
  en: bathroomEn,
  ja: bathroomJa,
  zh: bathroomZh,
  ru: bathroomRu,
  es: bathroomEs,
  fr: bathroomFr,
  pt: bathroomPt,
  id: bathroomId,
  hi: bathroomHi,
};

export const businessByLocale: Record<Locale, typeof businessKo> = {
  ko: businessKo,
  en: businessEn,
  ja: businessJa,
  zh: businessZh,
  ru: businessRu,
  es: businessEs,
  fr: businessFr,
  pt: businessPt,
  id: businessId,
  hi: businessHi,
};

export const snackbarByLocale: Record<Locale, typeof snackbarKo> = {
  ko: snackbarKo,
  en: snackbarEn,
  ja: snackbarJa,
  zh: snackbarZh,
  ru: snackbarRu,
  es: snackbarEs,
  fr: snackbarFr,
  pt: snackbarPt,
  id: snackbarId,
  hi: snackbarHi,
};

export function resolveLocalized<T>(map: Record<Locale, T>, locale: string): T {
  return (map as Record<string, T>)[locale] ?? map[routing.defaultLocale];
}
