const previewCache = new Map();
const SIGNED_URL_LIFETIME = 3600;
const CACHE_SAFETY_WINDOW = 60;

export async function getCachedPreviewUrl(supabase, bucket, storagePath) {
	const cacheKey = `${bucket}:${storagePath}`;
	const cached = previewCache.get(cacheKey);

	if (cached && cached.expiresAt > Date.now()) {
		return { data: { signedUrl: cached.signedUrl }, error: null };
	}

	previewCache.delete(cacheKey);

	const result = await supabase.storage
		.from(bucket)
		.createSignedUrl(storagePath, SIGNED_URL_LIFETIME);

	if (!result.error && result.data?.signedUrl) {
		previewCache.set(cacheKey, {
			signedUrl: result.data.signedUrl,
			expiresAt:
				Date.now() + (SIGNED_URL_LIFETIME - CACHE_SAFETY_WINDOW) * 1000,
		});
	}

	return result;
}
