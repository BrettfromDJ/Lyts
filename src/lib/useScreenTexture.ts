import * as THREE from 'three';

export type LoadedScreen = {
  texture: THREE.Texture;
  aspect: number; // width / height
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
