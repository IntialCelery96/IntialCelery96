import { useRef, useState } from 'react';
import { ApiError, api, type PublicUser } from '../lib/api';
import { Avatar } from './Avatar';

interface AvatarUploadProps {
  username: string | null;
  avatarUrl: string | null;
  onUploaded: (user: PublicUser) => void;
}

const MAX_BYTES = 5 * 1024 * 1024;

/**
 * Avatar picker with a client-side square crop.
 *
 * Cropping here means we upload a few hundred KB instead of a multi-megabyte
 * phone photo. The server re-encodes regardless — this is for the user's
 * bandwidth, not for trust.
 */
export function AvatarUpload({ username, avatarUrl, onUploaded }: AvatarUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File): Promise<void> {
    setError(null);

    if (file.size > MAX_BYTES) {
      setError('That image is larger than 5MB.');
      return;
    }

    setBusy(true);
    try {
      const cropped = await cropToSquare(file);
      setPreview(URL.createObjectURL(cropped));

      const form = new FormData();
      form.append('avatar', cropped, 'avatar.webp');
      const data = await api.upload<{ user: PublicUser }>('/api/profile/avatar', form);
      onUploaded(data.user);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not upload that image.');
      setPreview(null);
    } finally {
      setBusy(false);
    }
  }

  async function remove(): Promise<void> {
    setBusy(true);
    try {
      const data = await api.delete<{ user: PublicUser }>('/api/profile/avatar');
      setPreview(null);
      onUploaded(data.user);
    } catch {
      setError('Could not remove your photo.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-4">
      <Avatar username={username} avatarUrl={preview ?? avatarUrl} size="lg" />

      <div className="space-y-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void handleFile(file);
            event.target.value = '';
          }}
        />

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="btn-secondary text-sm"
            disabled={busy}
          >
            {busy ? 'Uploading…' : avatarUrl ? 'Change photo' : 'Upload photo'}
          </button>

          {avatarUrl && (
            <button type="button" onClick={() => void remove()} className="btn-ghost text-sm" disabled={busy}>
              Remove
            </button>
          )}
        </div>

        <p className="text-xs text-slate-500">PNG, JPEG, WebP or GIF. Cropped to a square.</p>
        {error && <p className="text-xs text-rose-400">{error}</p>}
      </div>
    </div>
  );
}

/**
 * Centre-crops an image to a square and re-encodes it as WebP at 512px.
 * Resolves with the original file if the browser cannot decode it — the server
 * will produce a clearer error than we can here.
 */
async function cropToSquare(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file;

  const size = Math.min(bitmap.width, bitmap.height);
  const target = Math.min(512, size);

  const canvas = document.createElement('canvas');
  canvas.width = target;
  canvas.height = target;

  const context = canvas.getContext('2d');
  if (!context) return file;

  context.drawImage(
    bitmap,
    (bitmap.width - size) / 2,
    (bitmap.height - size) / 2,
    size,
    size,
    0,
    0,
    target,
    target,
  );
  bitmap.close();

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob ?? file), 'image/webp', 0.9);
  });
}
