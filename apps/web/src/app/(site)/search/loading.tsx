import { LoadingRegion, PageHeroSkeleton, PostGridSkeleton } from "@/components/Skeletons";

export default function Loading() {
  return (
    <LoadingRegion label="Searching">
      <PageHeroSkeleton subtitle />
      <PostGridSkeleton count={3} />
    </LoadingRegion>
  );
}
