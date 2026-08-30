import { useEffect, useMemo, useRef, useState } from 'react';
import { AVATAR_PRESETS, avatarDataUri, presetIdFromUrl, type AvatarPreset } from '@connect4gg/engine';
import { ApiError, api } from '../lib/api';

/**
 * Avatar chooser: pick one of the built-in avatars, or upload a photo where
 * the deployment allows it.
 *
 * Presets come first and are the default. That ordering is the safety measure
 * as much as a convenience — a player who is happy with a preset never uploads
 * anything, and a photo of a real person is the hardest thing on a profile page
 * to keep appropriate.
 */

interface AvatarPickerProps {
  /** Current value: `avatar:<id>`, an uploaded URL, or null. */
  value: string | null;
  /** Called with a preset id when one is chosen. */
  onSelectPreset: (id: string) => void;
  /** Called with the new URL after a successful upload. */
  onUploaded?: (url: string | null) => void;
  /** Uploading needs an account; the setup screen has one, so this is on by default. */
  allowUpload?: boolean;
}

interface AvatarConfig {
  uploadsEnabled: boolean;
  policy: string;
}

const MAX_BYTES = 5 * 1024 * 1024;
/** Shown at once; the rest are a click away. */
const INITIAL_VISIBLE = 16;

export function AvatarPicker({
  value,
  onSelectPreset,
  onUploaded,
  allowUpload = true,
}: AvatarPickerProps) {
  const [config, setConfig] = useState<AvatarConfig | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedId = value ? presetIdFromUrl(value) : null;
  const hasPhoto = Boolean(value && !selectedId);

  useEffect(() => {
    api
      .get<AvatarConfig>('/api/avatars')
      .then(setConfig)
      // If the catalogue cannot be reached the presets still render — they are
      // bundled — so only the upload affordance is uncertain.
      .catch(() => setConfig({ uploadsEnabled: false, policy: 'presets' }));
  }, []);

  const visible = useMemo(
    () => (showAll ? AVATAR_PRESETS : AVATAR_PRESETS.slice(0, INITIAL_VISIBLE)),
    [showAll],
  );

  async function upload(file: File): Promise<void> {
    setError(null);
    if (file.size > MAX_BYTES) {
      setError('That image is larger than 5MB.');
      return;
    }

    setBusy(true);
    try {
      const cropped = await cropToSquare(file);
      const form = new FormData();
      form.append('avatar', cropped, 'avatar.webp');
      const data = await api.upload<{ user: { avatarUrl: string | null } }>(
        '/api/profile/avatar',
        form,
      );
      onUploaded?.(data.user.avatarUrl);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not upload that image.');
    } finally {
      setBusy(false);
    }
  }

  const canUpload = allowUpload && config?.uploadsEnabled === true;

  return (
    <div>
      <div
        className="grid grid-cols-8 gap-2 sm:grid-cols-8"
        role="radiogroup"
        aria-label="Choose an avatar"
      >
        {visible.map((preset) => (
          <PresetButton
            key={preset.id}
            preset={preset}
            selected={preset.id === selectedId}
            onSelect={() => onSelectPreset(preset.id)}
          />
        ))}
      </div>

      {!showAll && AVATAR_PRESETS.length > INITIAL_VISIBLE && (
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className="mt-2 text-xs text-accent-text hover:underline"
        >
          Show all {AVATAR_PRESETS.length} avatars
        </button>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void upload(file);
            event.target.value = '';
          }}
        />

        {canUpload ? (
          <>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="btn-secondary text-sm"
              disabled={busy}
            >
              {busy ? 'Uploading…' : hasPhoto ? 'Change photo' : 'Upload a photo'}
            </button>
            {hasPhoto && (
              <button
                type="button"
                onClick={() => {
                  void api
                    .delete<{ user: { avatarUrl: string | null } }>('/api/profile/avatar')
                    .then((data) => onUploaded?.(data.user.avatarUrl))
                    .catch(() => setError('Could not remove your photo.'));
                }}
                className="btn-ghost text-sm"
                disabled={busy}
              >
                Remove photo
              </button>
            )}
          </>
        ) : (
          config && (
            <p className="text-xs text-ink-4">
              Photo uploads are turned off on this server — the avatars above are the options.
            </p>
          )
        )}
      </div>

      {error && (
        <p className="mt-2 text-xs text-bad" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

function PresetButton({
  preset,
  selected,
  onSelect,
}: {
  preset: AvatarPreset;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-label={preset.label}
      title={preset.label}
      onClick={onSelect}
      className={`aspect-square overflow-hidden rounded-full transition ${
        selected
          ? 'ring-2 ring-accent ring-offset-2 ring-offset-bg'
          : 'ring-1 ring-line-2 hover:ring-line-2 hover:brightness-110'
      }`}
    >
      <img src={avatarDataUri(preset, 64)} alt="" className="h-full w-full" />
    </button>
  );
}

/**
 * Centre-crops to a square and re-encodes as WebP at 512px, so a phone photo
 * uploads as a few hundred KB rather than several megabytes. The server
 * re-encodes regardless; this is for the uploader's bandwidth.
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
