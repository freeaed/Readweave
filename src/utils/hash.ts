/**
 * Utility function to compute the SHA-256 hash of a Blob or File object.
 * @param data The Blob or File to hash.
 * @returns A Promise that resolves with the hex string representation of the hash.
 */
export async function getBlobHash(data: Blob): Promise<string> {
  const buffer = await data.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}
