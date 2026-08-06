import * as THREE from 'three';

export type LoadedScreen = {
  texture: THREE.Texture;
  aspect: number; // width / height
  isVideo?: boolean;
};

/**
 * File / Blob / data-URL -> THREE.Texture with the correct colorSpace.
 *
 * LANDMINE (spec §6.1): colorSpace MUST be SRGBColorSpace or every UI color
 * in the screenshot renders wrong (washed / dark). Anisotropy is bumped to
 * max inside the scene (where the renderer is available) for crisp glancing
 * angles — see DeviceMesh.
 */
export function loadScreenTexture(src: File | Blob | string): Promise<LoadedScreen> {
  return new Promise((resolve, reject) => {
    const url = typeof src === 'string' ? src : URL.createObjectURL(src);
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => {
      const texture = new THREE.Texture(image);
      texture.colorSpace = THREE.SRGBColorSpace; // REQUIRED
      texture.anisotropy = 8; // raised to GPU max in-scene
      texture.minFilter = THREE.LinearMipmapLinearFilter;
      texture.magFilter = THREE.LinearFilter;
      texture.generateMipmaps = true;
      texture.needsUpdate = true;
      if (typeof src !== 'string') URL.revokeObjectURL(url);
      resolve({
        texture,
        aspect: image.naturalWidth / image.naturalHeight || 16 / 10,
      });
    };
    image.onerror = (e) => {
      if (typeof src !== 'string') URL.revokeObjectURL(url);
      reject(e);
    };
    image.src = url;
  });
}

/**
 * File / Blob -> looping THREE.VideoTexture (muted, autoplay). The screen then
 * shows live video; the scene must run a continuous frameloop for it to update
 * (see `screenIsVideo` in the store / Scene). The object URL is kept alive for
 * the life of the texture and released by `disposeScreenTexture`.
 */
export function loadScreenVideoTexture(src: File | Blob): Promise<LoadedScreen> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(src);
    const video = document.createElement('video');
    video.src = url;
    video.loop = true;
    video.muted = true; // required for autoplay
    video.playsInline = true;
    video.crossOrigin = 'anonymous';
    video.preload = 'auto';

    video.onloadeddata = () => {
      // Upload happens on a user gesture, so muted autoplay is allowed.
      void video.play().catch(() => {});
      const texture = new THREE.VideoTexture(video);
      texture.colorSpace = THREE.SRGBColorSpace; // REQUIRED — see above
      texture.minFilter = THREE.LinearFilter; // video textures don't mipmap
      texture.magFilter = THREE.LinearFilter;
      texture.generateMipmaps = false;
      resolve({
        texture,
        aspect: video.videoWidth / video.videoHeight || 16 / 10,
        isVideo: true,
      });
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not decode that video.'));
    };
  });
}

/** Dispose a screen texture, tearing down the backing <video> + object URL. */
export function disposeScreenTexture(texture: THREE.Texture | null) {
  if (!texture) return;
  const src = (texture as THREE.Texture).image;
  if (src instanceof HTMLVideoElement) {
    const objUrl = src.src;
    src.pause();
    src.removeAttribute('src');
    src.load();
    if (objUrl.startsWith('blob:')) URL.revokeObjectURL(objUrl);
  }
  texture.dispose();
}
