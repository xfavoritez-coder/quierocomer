/** Extracted dish from a menu provider */
export interface ExtractedDish {
  name: string;
  description: string;
  price: number; // in CLP, integer
  imageUrl: string | null;
  category: string;
  diet?: "OMNIVORE" | "VEGAN" | "VEGETARIAN";
  isSpicy?: boolean;
}

/** Result of a menu extraction */
export interface ExtractionResult {
  restaurantName: string;
  dishes: ExtractedDish[];
  logoUrl: string | null;
  bannerUrl: string | null;
}
