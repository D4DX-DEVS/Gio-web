import { GallerySkeleton, LoadingRegion, PageHeroSkeleton } from "@/components/Skeletons";

export default function Loading() {
  return (
    <LoadingRegion label="Loading the gallery">
      <PageHeroSkeleton subtitle />
      <GallerySkeleton />
    </LoadingRegion>
  );
}
