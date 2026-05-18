/** Extracted dish from a menu provider */
export interface ExtractedDish {
  name: string;
  description: string;
  price: number; // in CLP, integer
  imageUrl: string | null;
  category: string;
  diet?: "OMNIVORE" | "VEGAN" | "VEGETARIAN";
  isSpicy?: boolean;
  /** Unsplash photographer credit (only for referential photos) */
  photoCredit?: { photographer: string; profileUrl: string; unsplashId: string } | null;
}

/** Result of a menu extraction */
export interface ExtractionResult {
  restaurantName: string;
  dishes: ExtractedDish[];
  logoUrl: string | null;
  bannerUrl: string | null;
}
