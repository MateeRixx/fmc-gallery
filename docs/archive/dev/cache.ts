/**
 * ISR (Incremental Static Regeneration) Cache Management
 *
 * Revalidates Next.js pages and route data after mutations.
 * Used in API routes to clear stale data when events/faces change.
 */

import { revalidatePath } from "next/cache";

/**
 * Revalidate cache after event mutations
 */
export async function revalidateEvent(eventId: string, slug?: string) {
  // Revalidate event detail page
  if (slug) {
    revalidatePath(`/events/${slug}`);
    revalidatePath(`/events/${slug}/faces`);
    revalidatePath(`/events/${slug}/faces/[clusterId]`);
  }

  // Revalidate events list
  revalidatePath("/events");
}

/**
 * Revalidate cache after cluster mutations
 */
export async function revalidateCluster(clusterId: number, eventId?: string) {
  // Revalidate cluster detail pages
  revalidatePath(`/people/${clusterId}`);
  revalidatePath(`/events/[slug]/faces/${clusterId}`);

  // Revalidate cluster list pages
  revalidatePath("/people");
}

/**
 * Revalidate all cluster-related caches
 * Called after face clustering/reclustering
 */
export async function revalidateAllClusters() {
  revalidatePath("/people");
  revalidatePath("/events/[slug]/faces");
  revalidatePath("/events/[slug]/faces/[clusterId]");
}

