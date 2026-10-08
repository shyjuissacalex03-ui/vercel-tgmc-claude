import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { db, auth } from "./config.ts";
import { isAdminUser } from "./authContext.tsx";
import { handleFirestoreError, OperationType } from "./errorHandler.ts";
import {
  churchInfo as defaultChurchInfo,
  pastorInfo as defaultPastorInfo,
  corePillars as defaultCorePillars,
  heroSlides as defaultHeroSlides,
  serviceSchedules as defaultServiceSchedules,
  upcomingEvents as defaultUpcomingEvents,
  galleryItems as defaultGalleryItems,
  statementsOfFaith as defaultStatementsOfFaith,
  ChurchInfo,
  ServiceSchedule,
  StatementOfFaith,
  GalleryItem,
  ChurchEvent,
} from "../data/churchData.ts";

export interface ChurchContentState {
  churchInfo: ChurchInfo;
  pastorInfo: typeof defaultPastorInfo;
  corePillars: typeof defaultCorePillars;
  heroSlides: typeof defaultHeroSlides;
  serviceSchedules: ServiceSchedule[];
  upcomingEvents: ChurchEvent[];
  galleryItems: GalleryItem[];
  statementsOfFaith: StatementOfFaith[];
}

interface ContentContextType {
  content: ChurchContentState;
  loading: boolean;
  saveContent: (updated: Partial<ChurchContentState>) => Promise<void>;
  resetToDefaults: () => Promise<void>;
}

const NO_PERMISSION = "You do not have permission to edit website content.";

type Loose = Record<string, any>;

const asObject = (value: unknown): Loose =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Loose) : {};

/**
 * Returns `value` as a list of complete items: every item gets the `blank` fields it is
 * missing, so pages never read `.toLowerCase()` or `.image` on undefined.
 * Falls back to `fallback` only when Firestore has no list at all.
 */
function asList<T extends object>(value: unknown, fallback: T[], blank: T, idPrefix?: string): T[] {
  if (!Array.isArray(value)) return fallback;
  return value
    .filter((item) => item && typeof item === "object")
    .map((item, index) => {
      const merged = { ...blank, ...(item as object) } as Loose;
      if (idPrefix && !merged.id) merged.id = `${idPrefix}-${index}`;
      return merged as T;
    });
}

// Earlier versions of the built-in content pointed at image files that were never added to
// /public/images. Content already saved in Firestore may still contain those paths.
const LEGACY_IMAGE_PATHS: Record<string, string> = {
  "/images/slide2.jpg": "/images/slide2.webp",
  "/images/livestream-preview.jpg": "/images/livestream-preview.png",
  "/images/pastor-begin-alex.jpg": "/images/pastor-begin-alex.webp",
};

const fixImagePath = (value: unknown): string =>
  typeof value === "string" ? LEGACY_IMAGE_PATHS[value] ?? value : "";

const fixImageField = <T extends object>(items: T[], field: keyof T): T[] =>
  items.map((item) => ({ ...item, [field]: fixImagePath(item[field]) }) as T);

/**
 * Builds a complete, safe content object from whatever is stored in Firestore.
 * Older or partially-saved documents are filled in with the built-in defaults.
 */
export function normalizeContent(data: unknown): ChurchContentState {
  const d = asObject(data);
  const info = asObject(d.churchInfo);
  const pastor = asObject(d.pastorInfo);

  const heroSlides = asList(d.heroSlides, defaultHeroSlides, {
    subtitle: "",
    title: "",
    description: "",
    image: "",
  });

  return {
    churchInfo: {
      ...defaultChurchInfo,
      ...info,
      address: { ...defaultChurchInfo.address, ...asObject(info.address) },
      contact: { ...defaultChurchInfo.contact, ...asObject(info.contact) },
    },
    pastorInfo: {
      ...defaultPastorInfo,
      ...pastor,
      image: fixImagePath(pastor.image ?? defaultPastorInfo.image),
    },
    corePillars: asList(d.corePillars, defaultCorePillars, { title: "", description: "", icon: "" }),
    // The home page always needs at least one slide.
    heroSlides: fixImageField(heroSlides.length > 0 ? heroSlides : defaultHeroSlides, "image"),
    serviceSchedules: asList<ServiceSchedule>(
      d.serviceSchedules,
      defaultServiceSchedules,
      { id: "", day: "", time: "", title: "", language: "", description: "", location: "", isLiveStreamed: false },
      "service"
    ),
    upcomingEvents: fixImageField(
      asList<ChurchEvent>(
        d.upcomingEvents,
        defaultUpcomingEvents,
        { id: "", title: "", date: "", time: "", location: "", category: "Worship", description: "", image: "", featured: false },
        "event"
      ),
      "image"
    ),
    galleryItems: fixImageField(
      asList<GalleryItem>(
        d.galleryItems,
        defaultGalleryItems,
        { id: "", title: "", category: "Worship", imageUrl: "", caption: "" },
        "photo"
      ),
      "imageUrl"
    ),
    statementsOfFaith: asList<StatementOfFaith>(
      d.statementsOfFaith,
      defaultStatementsOfFaith,
      { id: "", number: 0, title: "", summary: "", scriptures: [] },
      "statement"
    ),
  };
}

export const defaultContent: ChurchContentState = normalizeContent({});

const ContentContext = createContext<ContentContextType>({
  content: defaultContent,
  loading: true,
  saveContent: async () => {},
  resetToDefaults: async () => {},
});

export const useContent = () => useContext(ContentContext);

export const ContentProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [content, setContent] = useState<ChurchContentState>(defaultContent);
  const [loading, setLoading] = useState(true);

  // Always holds the latest content, so saveContent never merges into a stale copy.
  const contentRef = useRef(content);
  contentRef.current = content;

  useEffect(() => {
    const docRef = doc(db, "siteContent", "main");

    const unsubscribe = onSnapshot(
      docRef,
      (snapshot) => {
        setContent(snapshot.exists() ? normalizeContent(snapshot.data()) : defaultContent);
        setLoading(false);
      },
      (error) => {
        // Keep whatever is already on screen (defaults or the last good copy).
        console.warn("Firestore siteContent read error (showing built-in content):", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const saveContent = useCallback(async (updated: Partial<ChurchContentState>) => {
    // Only administrators can publish changes (also enforced by firestore.rules).
    if (!isAdminUser(auth.currentUser)) {
      throw new Error(NO_PERMISSION);
    }

    const next = normalizeContent({ ...contentRef.current, ...updated });

    try {
      // Full replace (no merge) so deleted events / photos / fields really disappear.
      await setDoc(doc(db, "siteContent", "main"), {
        ...next,
        updatedAt: new Date().toISOString(),
        updatedBy: auth.currentUser?.email || "",
      });
      setContent(next);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, "siteContent/main");
    }
  }, []);

  const resetToDefaults = useCallback(async () => {
    if (!isAdminUser(auth.currentUser)) {
      throw new Error(NO_PERMISSION);
    }

    try {
      await setDoc(doc(db, "siteContent", "main"), {
        ...defaultContent,
        updatedAt: new Date().toISOString(),
        updatedBy: auth.currentUser?.email || "",
      });
      setContent(defaultContent);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, "siteContent/main");
    }
  }, []);

  const value = useMemo(
    () => ({ content, loading, saveContent, resetToDefaults }),
    [content, loading, saveContent, resetToDefaults]
  );

  return <ContentContext.Provider value={value}>{children}</ContentContext.Provider>;
};
