import { useQuery } from "@tanstack/react-query";
import { ImageOff } from "lucide-react";
import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useT } from "@/i18n";
import { apiBlob, photoIdOf, photoSrc } from "@/lib/api";
import { cn } from "@/lib/utils";

/**
 * Where to load a report photo from. Visible reports use the public URL (cached as immutable, a
 * plain <img> works); the public endpoint refuses photos of hidden reports, so those are fetched
 * from the staff endpoint with the Bearer token and shown as a blob URL.
 */
const usePhotoUrl = (photoUrl: string | null, hidden: boolean) => {
  const id = photoIdOf(photoUrl);
  const blob = useQuery({
    queryKey: ["/v1/admin/photos", id],
    enabled: hidden && !!id,
    staleTime: Infinity,
    queryFn: ({ signal }) => apiBlob(`/v1/admin/photos/${id}`, signal),
  });
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!blob.data) return;
    const url = URL.createObjectURL(blob.data);
    setObjectUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [blob.data]);

  if (!hidden) return { src: photoSrc(photoUrl), loading: false, failed: false };
  return { src: objectUrl, loading: blob.isLoading, failed: !!blob.error };
};

type Props = {
  photoUrl: string | null;
  hidden: boolean;
  alt: string;
  className?: string;
  /** Open a full-size view on click. */
  zoomable?: boolean;
};

export function ReportPhoto({ photoUrl, hidden, alt, className, zoomable = true }: Props) {
  const t = useT();
  const { src, loading, failed } = usePhotoUrl(photoUrl, hidden);
  const [broken, setBroken] = useState(false);
  const [open, setOpen] = useState(false);
  if (!photoUrl) return null;
  if (loading) return <Skeleton className={className} />;
  if (failed || broken || !src) {
    return (
      <div
        className={cn("flex items-center justify-center bg-muted text-muted-foreground", className)}
        title={t("photo.unavailable")}
      >
        <ImageOff className="size-4" />
      </div>
    );
  }

  const img = (
    <img src={src} alt={alt} loading="lazy" onError={() => setBroken(true)} className={cn("object-cover", className)} />
  );
  if (!zoomable) return img;
  return (
    <>
      <button
        type="button"
        className="block w-full cursor-zoom-in overflow-hidden rounded-md"
        aria-label={t("photo.open")}
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
      >
        {img}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[min(95vw,1200px)] p-2 sm:max-w-[min(95vw,1200px)]">
          <DialogTitle className="sr-only">{alt}</DialogTitle>
          <img src={src} alt={alt} className="max-h-[85vh] w-full rounded object-contain" />
        </DialogContent>
      </Dialog>
    </>
  );
}
