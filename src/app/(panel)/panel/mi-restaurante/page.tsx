import { Suspense } from "react";
import MiRestaurantePage from "@/components/admin/pages/miRestaurantePage";
import SkeletonLoading from "@/components/admin/SkeletonLoading";

export default function Page() {
  return (
    <Suspense fallback={<SkeletonLoading type="form" />}>
      <MiRestaurantePage />
    </Suspense>
  );
}
