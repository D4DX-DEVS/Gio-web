import { DocumentListSkeleton, LoadingRegion, PageHeroSkeleton } from "@/components/Skeletons";

export default function Loading() {
  return (
    <LoadingRegion label="Loading documents">
      <PageHeroSkeleton />
      <DocumentListSkeleton />
    </LoadingRegion>
  );
}
